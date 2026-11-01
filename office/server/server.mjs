// Standalone local server (zero dependencies, Node 18+). For testing outside the OS or running the office on its own.
//   node office/build.mjs && node office/server/server.mjs      -> http://127.0.0.1:8790/office
// Env: OFFICE_PORT (8790), OFFICE_ROSTER (roster.json path), OFFICE_TITLE, OFFICE_DATA_DIR, NTFY_TOPIC, ALERT_STUCK_MIN, ALERT_COOLDOWN_MIN
import http from "node:http";
import { createOffice, handle, renderPage, loadRoster, signConfig } from "./office-core.mjs";
import HTML from "../dist/office-html.mjs";

const PORT = Number(process.env.OFFICE_PORT || 8790), BASE = "/api/office";
const office = createOffice();
const isLocal = (req) => ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress);

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost"), local = isLocal(req);
  const send = (code, body, type = "application/json") => { res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }); res.end(body); };
  if (url.pathname === "/" || url.pathname === "/office") {
    if (!local) return send(403, "local only", "text/plain");
    const rf = loadRoster();
    return send(200, renderPage(HTML, { title: process.env.OFFICE_TITLE || rf.title || "Agent Office", sign: signConfig(process.env, rf.sign), apiBase: BASE, roster: rf.bots }), "text/html; charset=utf-8");
  }
  if (!url.pathname.startsWith(BASE)) return send(404, '{"error":"not found"}');
  let raw = ""; for await (const c of req) { raw += c; if (raw.length > 65536) return send(413, '{"error":"too large"}'); }
  const r = await handle(office, { method: req.method, path: url.pathname.slice(BASE.length) || "/", query: url.searchParams, local,
    headers: { get: (k) => req.headers[k.toLowerCase()] || null }, json: async () => JSON.parse(raw || "null") });
  send(r.status, JSON.stringify(r.body));
}).listen(PORT, "127.0.0.1", () => console.log(`Agent Office on http://127.0.0.1:${PORT}/office`));
