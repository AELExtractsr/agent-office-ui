// relay-pull: mirrors Grok Bot statuses from a relay into the local office, and forwards page commands back.
// Grok Bots run in the cloud and can't reach your localhost, so they talk to a relay; this job (on your machine) polls it.
//   RELAY=worker  RELAY_URL=https://<your-worker>.workers.dev  RELAY_PUSH_TOKEN=...   (Option 1, see GROKBOT_SETUP.md)
//   RELAY=ntfy    NTFY_STATUS_TOPIC=...  NTFY_CMD_TOPIC=...  [NTFY_BASE=https://ntfy.sh]  (Option 2)
// Optional: OFFICE_URL (default http://127.0.0.1:8790/api/office; Next app: http://127.0.0.1:8081/api/office), RELAY_EVERY_SEC (15).
// Never logs URLs with topics or any token.
const env = process.env, MODE = env.RELAY || "worker", EVERY = Math.max(5, Number(env.RELAY_EVERY_SEC || 15)) * 1000;
const LOCAL = (env.OFFICE_URL || "http://127.0.0.1:8790/api/office").replace(/\/$/, "");
const NTFY = (env.NTFY_BASE || "https://ntfy.sh").replace(/\/$/, "");
const need = (k) => { if (!env[k]) { console.error(`relay-pull: set ${k}`); process.exit(2); } return env[k]; };
const R = MODE === "worker" ? { url: need("RELAY_URL").replace(/\/$/, ""), tok: need("RELAY_PUSH_TOKEN") } : { st: need("NTFY_STATUS_TOPIC"), cmd: need("NTFY_CMD_TOPIC") };
const seenUpd = {}; let ntfySince = "1h";
const J = { "Content-Type": "application/json" };
async function req(url, opt = {}) { const r = await fetch(url, opt); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r; }
const local = (p, body) => req(LOCAL + p, body ? { method: "POST", headers: J, body: JSON.stringify(body) } : {}).then((r) => r.json());

async function mirror(e) { // soft + ts keeps the bot's own timestamp, so staleness/stuck alerts stay correct
  const key = e.name.toLowerCase(); if (seenUpd[key] === e.updated) return; seenUpd[key] = e.updated;
  const b = { name: e.name, state: e.state, task: e.task || "", soft: true, ts: Math.min(e.updated, Math.floor(Date.now() / 1000)) };
  for (const k of ["step", "total", "with"]) if (e[k] != null) b[k] = e[k];
  await local("/report", b);
}
async function pullStatus() {
  if (MODE === "worker") {
    const list = await (await req(R.url + "/export", { headers: { Authorization: `Bearer ${R.tok}` } })).json();
    for (const e of list) if (e && e.name && e.state && typeof e.updated === "number") await mirror(e);
  } else {
    const txt = await (await req(`${NTFY}/${R.st}/json?poll=1&since=${ntfySince}`)).text();
    for (const line of txt.split("\n").filter(Boolean)) {
      let m; try { m = JSON.parse(line); } catch { continue; }
      if (m.event !== "message") continue; ntfySince = m.id;
      let s; try { s = JSON.parse(m.message); } catch { continue; }
      if (s && s.name && s.state) await mirror({ ...s, updated: m.time });
    }
  }
}
async function forwardCommands() {
  const queued = (await local("/commands")).filter((c) => c.state === "queued"); if (!queued.length) return;
  for (const c of queued) {
    const msg = { id: c.id, bot: c.bot, action: c.action, text: c.text };
    if (MODE === "worker") await req(R.url + "/enqueue", { method: "POST", headers: { ...J, Authorization: `Bearer ${R.tok}` }, body: JSON.stringify(msg) });
    else await req(`${NTFY}/${R.cmd}`, { method: "POST", body: JSON.stringify(msg) });
  }
  await local("/ack", { delivered: queued.map((c) => c.id) });
}
async function tick() {
  try { await pullStatus(); await forwardCommands(); }
  catch (e) { console.warn(new Date().toISOString(), "relay-pull:", e.message); }
}
console.log(`relay-pull: mode=${MODE}, every ${EVERY / 1000}s -> ${LOCAL}`);
tick(); setInterval(tick, EVERY);
