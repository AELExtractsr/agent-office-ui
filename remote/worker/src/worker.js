// Agent Office — optional REMOTE MODE on Cloudflare Workers (see REMOTE_ACCESS.md).
// Secrets (Worker secrets, never in code): OFFICE_PASSCODE, COOKIE_SECRET, PUSH_TOKEN, REPORT_TOKEN.
// Optional alerts: NTFY_TOPIC (secret; phone push via ntfy.sh, skipped if unset), NTFY_SERVER (default https://ntfy.sh),
//   ALERT_STUCK_MIN (default 30), ALERT_COOLDOWN_MIN (default 15), OFFICE_URL (link opened when tapping the push).
import { DurableObject } from "cloudflare:workers";
import APP_HTML from "./app.html"; // = office/dist/office.html (copied by deploy.sh)
import LOGIN_HTML from "./login.html";

const COOKIE = "office_session", LIFE = 30 * 86400, STALE_AFTER = 15 * 60;
const MAX_FAILS = 5, WINDOW = 600, GLOBAL_MAX = 40;
const enc = new TextEncoder();
const STATES = ["working", "needs_you", "idle", "error"];
const ALERT_MAX_PER_HOUR = 20; // hard cap on phone pushes (credits/noise guard)
const numEnv = (v, d, lo, hi) => { const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? n : d; };

const SEC = {
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Strict-Transport-Security": "max-age=31536000",
  "Content-Security-Policy": "default-src 'self' 'unsafe-inline' data: blob:; frame-ancestors 'self' http://127.0.0.1:8081 http://localhost:8081; base-uri 'none'; form-action 'self'",
};
function send(code, body, ctype = "text/html; charset=utf-8", extra = {}, cache = "no-store") {
  return new Response(body, { status: code, headers: { "Content-Type": ctype, "Cache-Control": cache, ...SEC, ...extra } });
}
const loginPage = (err) => LOGIN_HTML.replace("@@ERR@@", err);
// Page config: roster from the OFFICE_ROSTER_JSON var ({ title?, bots:[...] } or an array), API under /api
function appPage(env) {
  let r = {}; try { const j = JSON.parse(env.OFFICE_ROSTER_JSON || "{}"); r = Array.isArray(j) ? { bots: j } : j; } catch {}
  const cfg = JSON.stringify({ title: env.OFFICE_TITLE || r.title || "Agent Office", apiBase: "/api", loginUrl: "/", roster: Array.isArray(r.bots) ? r.bots : [] }).replace(/</g, "\\u003c");
  return APP_HTML.replace("<!--OFFICE_CONFIG-->", `<script>window.OFFICE_CONFIG=${cfg};</script>`);
}

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
async function sha256(s) { return new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s))); }
function ctEq(a, b) { // constant time on equal-length byte arrays
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i];
  return r === 0;
}
async function safeEq(a, b) { return ctEq(await sha256(a), await sha256(b)); }
async function hmacKey(env) {
  const base = await crypto.subtle.importKey("raw", enc.encode(env.COOKIE_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const raw = await crypto.subtle.sign("HMAC", base, enc.encode(env.OFFICE_PASSCODE)); // bound to passcode
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}
const b64u = (s) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function sign(env, exp) {
  const msg = String(exp);
  const sig = hex(await crypto.subtle.sign("HMAC", await hmacKey(env), enc.encode(msg)));
  return b64u(msg) + "." + sig;
}
async function validToken(env, tok) {
  try {
    const i = tok.indexOf("."); if (i < 0) return false;
    const b = tok.slice(0, i), sig = tok.slice(i + 1);
    const msg = atob(b.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (b.length % 4)) % 4));
    const want = hex(await crypto.subtle.sign("HMAC", await hmacKey(env), enc.encode(msg)));
    if (!ctEq(enc.encode(sig), enc.encode(want))) return false;
    return parseInt(msg, 10) > Date.now() / 1000;
  } catch { return false; }
}
async function authed(env, req) {
  for (const part of (req.headers.get("Cookie") || "").split(";")) {
    const t = part.trim(), i = t.indexOf("=");
    if (i > 0 && t.slice(0, i) === COOKIE && (await validToken(env, t.slice(i + 1)))) return true;
  }
  return false;
}

// 'with' = collaborators: one bot name or an array of names; max 5, each a non-empty string <= 60 chars
function cleanWith(v) {
  if (v == null) return null;
  const arr = Array.isArray(v) ? v : [v];
  if (arr.length > 5 || !arr.every((x) => typeof x === "string" && x.trim() && x.trim().length <= 60)) return undefined;
  return arr.length ? [...new Set(arr.map((x) => x.trim()))] : null;
}

// Normalize like server.py load_status()
function normalize(entries, now) {
  const out = [];
  for (const [slug, d] of Object.entries(entries || {})) {
    if (!d || typeof d !== "object" || Array.isArray(d)) continue;
    const upd = typeof d.updated === "number" ? Math.trunc(d.updated) : 0;
    const e = {
      slug: String(slug).slice(0, 80), name: String(d.name ?? "").slice(0, 120),
      state: STATES.includes(d.state) ? d.state : "idle",
      task: String(d.task ?? "").slice(0, 400), updated: upd,
      age: upd ? Math.max(0, Math.trunc(now - upd)) : null,
      stale: !upd || now - upd > STALE_AFTER,
    };
    for (const k of ["step", "total"]) if (typeof d[k] === "number") e[k] = Math.trunc(d[k]);
    const w = cleanWith(d.with); if (w) e.with = w;
    out.push(e);
  }
  return out.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}

export class Office extends DurableObject {
  async locked(ip) {
    const now = Date.now() / 1000;
    const l = ((await this.ctx.storage.get("f:" + ip)) || []).filter((t) => now - t < WINDOW);
    const g = ((await this.ctx.storage.get("g")) || []).filter((t) => now - t < WINDOW);
    return l.length >= MAX_FAILS || g.length >= GLOBAL_MAX;
  }
  async recordFail(ip) {
    const now = Date.now() / 1000;
    const l = ((await this.ctx.storage.get("f:" + ip)) || []).filter((t) => now - t < WINDOW); l.push(now);
    const g = ((await this.ctx.storage.get("g")) || []).filter((t) => now - t < WINDOW); g.push(now);
    await this.ctx.storage.put({ ["f:" + ip]: l, g });
  }
  async clearAllFails() { const all = await this.ctx.storage.list({ prefix: "f:" }); await this.ctx.storage.delete([...all.keys()]); await this.ctx.storage.delete("g"); }
  async clearFails(ip) { await this.ctx.storage.delete("f:" + ip); }
  async setStatus(entries) {
    const cur = await this.ctx.storage.get("status");
    if (JSON.stringify(cur) !== JSON.stringify(entries)) await this.ctx.storage.put("status", entries);
    await this.ctx.storage.put("pushed_at", Math.floor(Date.now() / 1000));
    await this.checkAlerts();
  }
  async getStatus() {
    const box = (await this.ctx.storage.get("status")) || {}, rep = (await this.ctx.storage.get("reported")) || {};
    const merged = { ...box };
    for (const [k, v] of Object.entries(rep)) { const b = merged[k]; if (!b || !(typeof b.updated === "number") || v.updated >= b.updated) merged[k] = { ...v, source: "report" }; }
    return normalize(merged, Date.now() / 1000).map((e) => (rep[e.slug] && merged[e.slug].source === "report" ? { ...e, source: "report" } : e));
  }
  // last own-status time per bot = the 'updated' of its entry from /push (box sync of the bot's own set-status file)
  async ownAt(slug) { const box = (await this.ctx.storage.get("status")) || {}; const d = box[slug]; return d && typeof d.updated === "number" ? d.updated : null; }
  // soft report: applied only if strictly newer than the bot's last own push; non-soft: always applied (authoritative, never counts as own push)
  async reportV2(slug, entry, soft = false) {
    if (soft) { const own = await this.ownAt(slug); if (own != null && entry.updated <= own) return { applied: false, own }; }
    const rep = (await this.ctx.storage.get("reported")) || {}; rep[slug] = entry; await this.ctx.storage.put("reported", rep); await this.checkAlerts(); return { applied: true };
  }
  async unreport(slug) { const rep = (await this.ctx.storage.get("reported")) || {}; const had = slug in rep; delete rep[slug]; await this.ctx.storage.put("reported", rep); await this.checkAlerts(); return had; }
  // ---- alerts: needs_you (waiting on user) + stuck (working, no update for ALERT_STUCK_MIN). One alert per state change, cooldown per bot.
  async checkAlerts() {
    try {
      const env = this.env, now = Math.floor(Date.now() / 1000);
      const stuckSec = numEnv(env.ALERT_STUCK_MIN, 30, 1, 1440) * 60, coolSec = numEnv(env.ALERT_COOLDOWN_MIN, 15, 0, 1440) * 60;
      const list = await this.getStatus();
      const prev = (await this.ctx.storage.get("alerts")) || {}, sent = (await this.ctx.storage.get("alert_sent")) || {};
      let hour = ((await this.ctx.storage.get("alert_hour")) || []).filter((t) => now - t < 3600);
      const next = {}, fire = []; let wake = null;
      for (const e of list) {
        let kind = null;
        if (e.state === "needs_you") kind = "needs_you";
        else if (e.state === "working" && e.updated) {
          if (now - e.updated >= stuckSec) kind = "stuck";
          else { const t = e.updated + stuckSec; wake = wake == null ? t : Math.min(wake, t); }
        }
        if (!kind) continue;
        const old = prev[e.slug];
        if (old && old.kind === kind) { next[e.slug] = { ...old, task: e.task, updated: e.updated }; continue; } // dedupe: same state, no new alert
        const a = { kind, slug: e.slug, name: e.name || e.slug, task: e.task, updated: e.updated, since: now, pushed: false };
        if (now - (sent[e.slug] || 0) >= coolSec && hour.length < ALERT_MAX_PER_HOUR) { a.pushed = true; sent[e.slug] = now; hour.push(now); fire.push(a); }
        next[e.slug] = a;
      }
      if (JSON.stringify(prev) !== JSON.stringify(next)) await this.ctx.storage.put("alerts", next);
      if (fire.length) await this.ctx.storage.put({ alert_sent: sent, alert_hour: hour });
      // stuck detection without traffic: wake at the earliest moment a working bot would cross the threshold
      if (wake != null) { const at = Math.max(wake + 5, now + 60) * 1000, cur = await this.ctx.storage.getAlarm(); if (cur == null || cur > at || cur < Date.now()) await this.ctx.storage.setAlarm(at); }
      else await this.ctx.storage.deleteAlarm();
      for (const a of fire) await this.notify(a);
    } catch (err) { console.log("alerts: check failed", String(err).slice(0, 200)); }
  }
  async alarm() { await this.checkAlerts(); }
  async notify(a) {
    const topic = this.env.NTFY_TOPIC; if (!topic) return; // phone push optional
    const server = (this.env.NTFY_SERVER || "https://ntfy.sh").replace(/\/+$/, "");
    const stuck = a.kind === "stuck", ascii = (s) => String(s).replace(/[^\x20-\x7e]/g, "").slice(0, 120);
    const headers = { Title: ascii(stuck ? `${a.name} looks stuck` : `${a.name} needs you`), Priority: stuck ? "default" : "high", Tags: stuck ? "hourglass" : "raising_hand" };
    if (this.env.OFFICE_URL) headers.Click = this.env.OFFICE_URL;
    const body = (a.task || (stuck ? "No update for a while" : "Waiting for your input")) + (stuck ? ` (no update for ${Math.round((Date.now() / 1000 - a.updated) / 60)} min)` : "");
    try { const r = await fetch(`${server}/${encodeURIComponent(topic)}`, { method: "POST", headers, body: body.slice(0, 400) }); if (!r.ok) console.log("alerts: ntfy status", r.status); }
    catch { console.log("alerts: ntfy failed"); } // never log the topic (it is the secret)
  }
  async getAlerts() {
    const env = this.env;
    return { stuck_min: numEnv(env.ALERT_STUCK_MIN, 30, 1, 1440), phone: !!env.NTFY_TOPIC, alerts: Object.values((await this.ctx.storage.get("alerts")) || {}) };
  }
  async addCmd(c) { const q = (await this.ctx.storage.get("cmds")) || []; q.push(c); while (q.length > 200) q.shift(); await this.ctx.storage.put("cmds", q); }
  async listCmds(n = 40) { return ((await this.ctx.storage.get("cmds")) || []).slice(-n); }
  async takeInbox(slug) { const now = Math.floor(Date.now() / 1000), q = (await this.ctx.storage.get("cmds")) || [], out = q.filter((c) => c.state === "queued" && c.slug === slug); out.forEach((c) => { c.state = "delivered"; c.delivered_at = now; }); if (out.length) await this.ctx.storage.put("cmds", q); return out; }
  async pending() { return ((await this.ctx.storage.get("cmds")) || []).filter((c) => c.state === "queued"); }
  async ack(b) {
    const now = Math.floor(Date.now() / 1000), del = new Set(b.delivered || []), seen = new Set(b.seen || []), rm = new Set(b.remove || []);
    let q = (await this.ctx.storage.get("cmds")) || [];
    for (const c of q) {
      if (del.has(c.id) && c.state === "queued") { c.state = "delivered"; c.delivered_at = now; }
      if (seen.has(c.id) && c.state !== "seen") { c.state = "seen"; c.seen_at = now; c.delivered_at ??= now; }
    }
    q = q.filter((c) => !rm.has(c.id));
    await this.ctx.storage.put("cmds", q); return true;
  }
}

const J = (code, o) => send(code, JSON.stringify(o), "application/json");
async function bearer(req, tok) { const h = req.headers.get("Authorization") || ""; return !!tok && h.startsWith("Bearer ") && (await safeEq(h.slice(7), tok)); }
const slugify = (n) => String(n).toLowerCase().replace(/[^a-z0-9\n]/g, "-").replace(/-+$/, "").slice(0, 80);
async function readJson(req, max = 16384) { const t = await req.text(); if (t.length > max) throw 413; try { const b = JSON.parse(t); if (!b || typeof b !== "object" || Array.isArray(b)) throw 0; return b; } catch { throw 400; } }

export default {
  async fetch(req, env) {
    if (!env.OFFICE_PASSCODE || !env.COOKIE_SECRET || !env.PUSH_TOKEN) return send(500, "Not configured", "text/plain");
    const url = new URL(req.url), path = url.pathname, m = req.method;
    const office = env.OFFICE.get(env.OFFICE.idFromName("main"));

    if (path === "/robots.txt") return send(200, "User-agent: *\nDisallow: /\n", "text/plain; charset=utf-8", {}, "public, max-age=3600");
    if (path === "/healthz") return send(200, "ok", "text/plain");

    if (path === "/reset-lockout" && m === "POST") { // Bearer PUSH_TOKEN
      const h = req.headers.get("Authorization") || "";
      if (!h.startsWith("Bearer ") || !(await safeEq(h.slice(7), env.PUSH_TOKEN))) return send(401, '{"error":"unauthorized"}', "application/json");
      await office.clearAllFails(); return send(200, '{"ok":true}', "application/json");
    }
    if (path === "/push") { // box -> worker, Bearer PUSH_TOKEN (separate from passcode)
      if (m !== "POST" && m !== "PUT") return send(405, "Method not allowed", "text/plain");
      const h = req.headers.get("Authorization") || "";
      if (!h.startsWith("Bearer ") || !(await safeEq(h.slice(7), env.PUSH_TOKEN))) return send(401, '{"error":"unauthorized"}', "application/json");
      const txt = await req.text();
      if (txt.length > 262144) return send(413, '{"error":"too large"}', "application/json");
      let body; try { body = JSON.parse(txt); } catch { return send(400, '{"error":"bad json"}', "application/json"); }
      if (!body || typeof body !== "object" || Array.isArray(body)) return send(400, '{"error":"expected object slug->status"}', "application/json");
      await office.setStatus(body);
      return send(200, '{"ok":true}', "application/json");
    }

    if (path === "/export" && m === "GET") { // relay: local OS pulls current statuses, Bearer PUSH_TOKEN
      if (!(await bearer(req, env.PUSH_TOKEN))) return J(401, { error: "unauthorized" });
      return J(200, await office.getStatus());
    }
    if (path === "/enqueue" && m === "POST") { // relay: local OS forwards approve/decline/nudge for bots, Bearer PUSH_TOKEN
      if (!(await bearer(req, env.PUSH_TOKEN))) return J(401, { error: "unauthorized" });
      let b; try { b = await readJson(req); } catch (e) { return J(e, { error: "bad json" }); }
      const bot = String(b.bot || "").trim().slice(0, 120), action = b.action, text = String(b.text ?? "").slice(0, 500);
      if (!bot || !["approve", "decline", "nudge"].includes(action)) return J(400, { error: "bot and action required" });
      const c = { id: String(b.id || crypto.randomUUID()).slice(0, 64), bot, slug: slugify(bot), action, text, created: Math.floor(Date.now() / 1000), state: "queued" };
      await office.addCmd(c); return J(200, c);
    }
    if (path === "/inbox" && m === "GET") { // bots read their commands, Bearer REPORT_TOKEN; marks them delivered
      if (!(await bearer(req, env.REPORT_TOKEN))) return J(401, { error: "unauthorized" });
      const slug = slugify(String(url.searchParams.get("bot") || "").trim()); if (!slug) return J(400, { error: "bot required" });
      return J(200, await office.takeInbox(slug));
    }
    if (path === "/pull" || path === "/ack") { // box <-> worker command queue, Bearer PUSH_TOKEN
      if (!(await bearer(req, env.PUSH_TOKEN))) return J(401, { error: "unauthorized" });
      if (path === "/pull" && m === "GET") return J(200, await office.pending());
      if (path === "/ack" && m === "POST") {
        let b; try { b = await readJson(req, 65536); } catch (e) { return J(e, { error: "bad request" }); }
        await office.ack(b); return J(200, { ok: true });
      }
      return J(405, { error: "method" });
    }
    if (path === "/report") { // outside reporters, Bearer REPORT_TOKEN
      if (!(await bearer(req, env.REPORT_TOKEN))) return J(401, { error: "unauthorized" });
      if (m !== "POST" && m !== "DELETE") return J(405, { error: "method" });
      let b; try { b = await readJson(req); } catch (e) { return J(e, { error: "bad json" }); }
      const name = String(b.name || "").trim().slice(0, 120), slug = slugify(name);
      if (!slug) return J(400, { error: "name required" });
      if (m === "DELETE") return J(200, { ok: true, removed: await office.unreport(slug) });
      if (!STATES.includes(b.state)) return J(400, { error: "state must be one of " + STATES.join("|") });
      if (b.soft != null && typeof b.soft !== "boolean") return J(400, { error: "soft must be a boolean" });
      const now = Math.floor(Date.now() / 1000);
      let ts = now; // a soft report may say when its info was observed ('ts', unix seconds, not in the future)
      if (b.ts != null) { if (!b.soft || typeof b.ts !== "number" || !Number.isFinite(b.ts) || b.ts > now + 60 || b.ts < 0) return J(400, { error: "ts must be unix seconds (soft reports only)" }); ts = Math.min(Math.trunc(b.ts), now); }
      const e = { name, state: b.state, task: String(b.task ?? "").slice(0, 400), updated: ts };
      for (const k of ["step", "total"]) if (b[k] != null) { const v = Number(b[k]); if (Number.isFinite(v)) e[k] = Math.trunc(v); }
      if (b.with != null) { const w = cleanWith(b.with); if (w === undefined) return J(400, { error: "with must be a bot name or an array of up to 5 names (strings, max 60 chars)" }); if (w) e.with = w; }
      const r = await office.reportV2(slug, e, b.soft === true);
      return J(200, r.applied ? { ok: true, applied: true, slug, ...(b.soft ? { soft: true } : {}) } : { ok: true, applied: false, reason: "newer own status", slug });
    }

    if (path === "/logout") return send(303, "", "text/html", { Location: "/", "Set-Cookie": `${COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=None; Partitioned` });

    if (path === "/login" && m === "POST") {
      let ip = (req.headers.get("CF-Connecting-IP") || "unknown").slice(0, 64);
      if (ip.includes(":")) ip = ip.split(":").slice(0, 3).join(":"); // IPv6: key by /48 (clients rotate addresses)
      let body = ""; try { body = (await req.text()).slice(0, 4096); } catch {}
      if (await office.locked(ip)) return send(429, loginPage('<div class="e">Too many attempts. Try again in 10 minutes.</div>'), "text/html; charset=utf-8", { "Retry-After": "600" });
      const cand = new URLSearchParams(body).get("passcode") || "";
      if (await safeEq(cand, env.OFFICE_PASSCODE)) {
        await office.clearFails(ip);
        const ck = `${COOKIE}=${await sign(env, Math.floor(Date.now() / 1000) + LIFE)}; Max-Age=${LIFE}; Path=/; HttpOnly; Secure; SameSite=None; Partitioned`;
        return send(303, "", "text/html", { Location: "/", "Set-Cookie": ck });
      }
      await office.recordFail(ip); await new Promise((r) => setTimeout(r, 600));
      return send(401, loginPage('<div class="e">Wrong passcode.</div>'));
    }
    if (path === "/login") return send(404, "Not found", "text/plain");

    const ok = await authed(env, req);
    if (path === "/api/command") {
      if (!ok) return J(401, { error: "unauthorized" });
      if (m !== "POST") return J(405, { error: "method" });
      const origin = req.headers.get("Origin") || "";
      const allowed = [url.origin, "http://127.0.0.1:8081", "http://localhost:8081"];
      if (req.headers.get("X-Office") !== "1" || !allowed.includes(origin)) return J(403, { error: "forbidden" });
      let b; try { b = await readJson(req); } catch (e) { return J(e, { error: "bad json" }); }
      const bot = String(b.bot || "").trim().slice(0, 120), action = b.action, text = String(b.text ?? "").slice(0, 500);
      if (!bot || !["approve", "decline", "nudge"].includes(action)) return J(400, { error: "bot and action approve|decline|nudge required" });
      if (action === "nudge" && !text.trim()) return J(400, { error: "text required" });
      const c = { id: crypto.randomUUID(), bot, slug: slugify(bot), action, text, created: Math.floor(Date.now() / 1000), state: "queued" };
      await office.addCmd(c); return J(200, c);
    }
    if (m !== "GET" && m !== "HEAD") return send(ok ? 405 : 401, ok ? "Method not allowed" : "Unauthorized", "text/plain");
    if (path === "/" || path === "/index.html") {
      if (ok) return send(200, m === "HEAD" ? null : appPage(env));
      return path === "/" ? send(200, loginPage("")) : send(401, "Unauthorized", "text/plain");
    }
    if (path === "/api/status") {
      if (!ok) return send(401, '{"error":"unauthorized"}', "application/json");
      return send(200, JSON.stringify(await office.getStatus()), "application/json");
    }
    if (path === "/api/alerts") {
      if (!ok) return J(401, { error: "unauthorized" });
      try { return J(200, await office.getAlerts()); }
      catch (err) { if (!/does not implement/.test(String(err))) throw err; return J(200, { alerts: [], pending: "office object still on previous code" }); } // DO not restarted yet
    }
    if (path === "/api/commands") {
      if (!ok) return J(401, { error: "unauthorized" });
      return J(200, await office.listCmds());
    }
    return send(ok ? 404 : 401, ok ? "Not found" : "Unauthorized", "text/plain");
  },
};
