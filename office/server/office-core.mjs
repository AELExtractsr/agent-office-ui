// Agent Office core: framework-free state + logic shared by the Next route and the standalone server.
// Storage: one JSON file (OFFICE_DATA_DIR, default ./.office-data/office.json). Single process, local use.
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export const STATES = ["working", "needs_you", "idle", "error"];
const STALE_AFTER = 15 * 60, ALERT_MAX_PER_HOUR = 20;
const num = (v, d, lo, hi) => { const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? n : d; };
const nowS = () => Math.floor(Date.now() / 1000);
export const slugify = (n) => String(n).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

export function cleanWith(v) { // one bot name or array of up to 5 names (<=60 chars each)
  if (v == null) return null;
  const arr = Array.isArray(v) ? v : [v];
  if (arr.length > 5 || !arr.every((x) => typeof x === "string" && x.trim() && x.trim().length <= 60)) return undefined;
  return arr.length ? [...new Set(arr.map((x) => x.trim()))] : null;
}

export function createOffice(opts = {}) {
  const env = opts.env || process.env;
  const dir = env.OFFICE_DATA_DIR || join(process.cwd(), ".office-data"), file = join(dir, "office.json");
  const cfg = () => ({ stuckSec: num(env.ALERT_STUCK_MIN, 30, 1, 1440) * 60, coolSec: num(env.ALERT_COOLDOWN_MIN, 15, 0, 1440) * 60 });
  let db = { reported: {}, cmds: [], alerts: {}, alert_sent: {}, alert_hour: [] };
  try { if (existsSync(file)) db = { ...db, ...JSON.parse(readFileSync(file, "utf8")) }; } catch { /* start fresh on corrupt file */ }
  const save = () => { mkdirSync(dir, { recursive: true }); const t = file + ".tmp"; writeFileSync(t, JSON.stringify(db)); renameSync(t, file); };

  function status() {
    const now = nowS();
    return Object.entries(db.reported).map(([slug, d]) => {
      const e = { slug, name: d.name, state: STATES.includes(d.state) ? d.state : "idle", task: d.task || "", updated: d.updated,
        age: d.updated ? Math.max(0, now - d.updated) : null, stale: !d.updated || now - d.updated > STALE_AFTER };
      for (const k of ["step", "total"]) if (typeof d[k] === "number") e[k] = d[k];
      if (d.with) e.with = d.with; if (d.own) e.source = "own";
      return e;
    }).sort((a, b) => (a.slug < b.slug ? -1 : 1));
  }

  // body = { name, state, task?, step?, total?, with?, soft?, ts? }. own=true: the bot's own status (soft reports never override a newer own one)
  function report(b, { own = false } = {}) {
    const name = String(b.name || "").trim().slice(0, 120), slug = slugify(name);
    if (!slug) return [400, { error: "name required" }];
    if (!STATES.includes(b.state)) return [400, { error: "state must be one of " + STATES.join("|") }];
    if (b.soft != null && typeof b.soft !== "boolean") return [400, { error: "soft must be a boolean" }];
    const now = nowS(); let ts = now;
    if (b.ts != null) { if (!b.soft || typeof b.ts !== "number" || !Number.isFinite(b.ts) || b.ts > now + 60 || b.ts < 0) return [400, { error: "ts must be unix seconds (soft reports only)" }]; ts = Math.min(Math.trunc(b.ts), now); }
    const e = { name, state: b.state, task: String(b.task ?? "").slice(0, 400), updated: ts };
    for (const k of ["step", "total"]) if (b[k] != null) { const v = Number(b[k]); if (Number.isFinite(v)) e[k] = Math.trunc(v); }
    if (b.with != null) { const w = cleanWith(b.with); if (w === undefined) return [400, { error: "with must be a bot name or an array of up to 5 names (strings, max 60 chars)" }]; if (w) e.with = w; }
    const cur = db.reported[slug];
    if (b.soft === true && cur && cur.ownAt != null && ts <= cur.ownAt) return [200, { ok: true, applied: false, reason: "newer own status", slug }];
    if (own) e.ownAt = ts; else if (cur && cur.ownAt != null) e.ownAt = cur.ownAt;
    db.reported[slug] = e; checkAlerts(); save();
    return [200, { ok: true, applied: true, slug, ...(b.soft ? { soft: true } : {}) }];
  }
  function unreport(name) { const slug = slugify(name || ""); const had = slug in db.reported; delete db.reported[slug]; checkAlerts(); save(); return [200, { ok: true, removed: had }]; }

  // ---- command queue (approve / decline / nudge from the page -> bot inbox) ----
  function addCommand(b) {
    const bot = String(b.bot || "").trim().slice(0, 120), action = b.action, text = String(b.text ?? "").slice(0, 500);
    if (!bot || !["approve", "decline", "nudge"].includes(action)) return [400, { error: "bot and action approve|decline|nudge required" }];
    if (action === "nudge" && !text.trim()) return [400, { error: "text required" }];
    const c = { id: randomUUID(), bot, slug: slugify(bot), action, text, created: nowS(), state: "queued" };
    db.cmds.push(c); while (db.cmds.length > 200) db.cmds.shift(); save(); return [200, c];
  }
  const listCommands = (n = 40) => db.cmds.slice(-n);
  // inbox for one bot (or all): queued commands; mark=true marks them delivered
  function inbox(bot, mark = true) {
    const slug = bot ? slugify(bot) : null, now = nowS();
    const out = db.cmds.filter((c) => c.state === "queued" && (!slug || c.slug === slug));
    if (mark && out.length) { out.forEach((c) => { c.state = "delivered"; c.delivered_at = now; }); save(); }
    return out;
  }
  function ack(b) { // { delivered:[ids], seen:[ids], remove:[ids] }
    const now = nowS(), del = new Set(b.delivered || []), seen = new Set(b.seen || []), rm = new Set(b.remove || []);
    for (const c of db.cmds) {
      if (del.has(c.id) && c.state === "queued") { c.state = "delivered"; c.delivered_at = now; }
      if (seen.has(c.id) && c.state !== "seen") { c.state = "seen"; c.seen_at = now; c.delivered_at ??= now; }
    }
    db.cmds = db.cmds.filter((c) => !rm.has(c.id)); save(); return [200, { ok: true }];
  }

  // ---- alerts: needs_you + stuck (working, no update for ALERT_STUCK_MIN). One per state change; per-bot cooldown for push.
  function checkAlerts() {
    const now = nowS(), { stuckSec, coolSec } = cfg(), next = {}, fire = [];
    db.alert_hour = (db.alert_hour || []).filter((t) => now - t < 3600);
    for (const e of status()) {
      let kind = null;
      if (e.state === "needs_you") kind = "needs_you";
      else if (e.state === "working" && e.updated && now - e.updated >= stuckSec) kind = "stuck";
      if (!kind) continue;
      const old = db.alerts[e.slug];
      if (old && old.kind === kind) { next[e.slug] = { ...old, task: e.task, updated: e.updated }; continue; }
      const a = { kind, slug: e.slug, name: e.name, task: e.task, updated: e.updated, since: now, pushed: false };
      if (now - (db.alert_sent[e.slug] || 0) >= coolSec && db.alert_hour.length < ALERT_MAX_PER_HOUR) { a.pushed = !!env.NTFY_TOPIC; db.alert_sent[e.slug] = now; db.alert_hour.push(now); fire.push(a); }
      next[e.slug] = a;
    }
    const changed = JSON.stringify(next) !== JSON.stringify(db.alerts); db.alerts = next;
    for (const a of fire) notify(a);
    return changed;
  }
  async function notify(a) {
    const topic = env.NTFY_TOPIC; if (!topic) return; // optional phone push
    const server = (env.NTFY_SERVER || "https://ntfy.sh").replace(/\/+$/, ""), stuck = a.kind === "stuck";
    const ascii = (s) => String(s).replace(/[^\x20-\x7e]/g, "").slice(0, 120);
    const headers = { Title: ascii(stuck ? `${a.name} looks stuck` : `${a.name} needs you`), Priority: stuck ? "default" : "high", Tags: stuck ? "hourglass" : "raising_hand" };
    if (env.OFFICE_URL) headers.Click = env.OFFICE_URL;
    try { await fetch(`${server}/${encodeURIComponent(topic)}`, { method: "POST", headers, body: (a.task || (stuck ? "No update for a while" : "Waiting for your input")).slice(0, 400) }); }
    catch { console.warn("office alerts: ntfy push failed"); } // never log the topic
  }
  const alerts = () => ({ stuck_min: cfg().stuckSec / 60, phone: !!env.NTFY_TOPIC, alerts: Object.values(db.alerts) });
  // stuck detection without traffic (replaces the Worker's Durable Object alarm)
  const timer = setInterval(() => { if (checkAlerts()) save(); }, 60_000); timer.unref?.();

  return { status, report, unreport, addCommand, listCommands, inbox, ack, alerts, checkAlerts };
}

// ---- tiny router shared by Next and the standalone server ----
// req-like: { method, path (after the api base, e.g. "/status"), query: URLSearchParams, json(): Promise<object>, headers: Headers-like get(), local: boolean }
export async function handle(office, r, env = process.env) {
  const J = (code, body) => ({ status: code, body });
  const token = env.OFFICE_REPORT_TOKEN; // optional: required for writes from non-local callers
  const authed = r.local || (token && (r.headers.get("authorization") || "") === "Bearer " + token);
  const body = async () => { try { const b = await r.json(); return b && typeof b === "object" && !Array.isArray(b) ? b : null; } catch { return null; } };
  const p = r.path.replace(/\/+$/, "") || "/", m = r.method;
  if (p === "/health") return J(200, { ok: true });
  if (!authed) return J(401, { error: "unauthorized" });
  // CSRF guard: writes must be JSON (forces a CORS preflight, so other websites can't post to localhost); page commands also send X-Office: 1
  if (m !== "GET" && m !== "HEAD" && !/^application\/json/i.test(r.headers.get("content-type") || "")) return J(415, { error: "content-type must be application/json" });
  if (r.path.startsWith("/command") && m === "POST" && r.headers.get("x-office") !== "1") return J(403, { error: "forbidden" });
  if (p === "/status" && m === "GET") return J(200, office.status());
  if (p === "/alerts" && m === "GET") { office.checkAlerts(); return J(200, office.alerts()); }
  if (p === "/commands" && m === "GET") return J(200, office.listCommands());
  if (p === "/report") {
    const b = await body(); if (!b) return J(400, { error: "bad json" });
    if (m === "DELETE") { const [c, o] = office.unreport(b.name); return J(c, o); }
    if (m !== "POST") return J(405, { error: "method" });
    const [c, o] = office.report(b, { own: r.query.get("own") === "1" || b.own === true }); return J(c, o);
  }
  if (p === "/command" && m === "POST") { const b = await body(); if (!b) return J(400, { error: "bad json" }); const [c, o] = office.addCommand(b); return J(c, o); }
  if (p === "/inbox" && m === "GET") return J(200, office.inbox(r.query.get("bot"), r.query.get("peek") !== "1"));
  if (p === "/ack" && m === "POST") { const b = await body(); if (!b) return J(400, { error: "bad json" }); const [c, o] = office.ack(b); return J(c, o); }
  return J(404, { error: "not found" });
}

// HTML with runtime config injected (roster, title, api base)
export function renderPage(html, config) {
  const json = JSON.stringify(config).replace(/</g, "\\u003c");
  return html.replace("<!--OFFICE_CONFIG-->", `<script>window.OFFICE_CONFIG=${json};</script>`);
}

// Roster file: OFFICE_ROSTER (path) or ./roster.json -> { title?, bots: [] }. Missing file -> no bots (page shows a demo roster).
export function loadRoster(env = process.env) {
  const f = env.OFFICE_ROSTER || join(process.cwd(), "roster.json");
  try { const j = JSON.parse(readFileSync(f, "utf8")); return Array.isArray(j) ? { bots: j } : { title: j.title, bots: Array.isArray(j.bots) ? j.bots : [] }; } catch { return { bots: [] }; }
}
