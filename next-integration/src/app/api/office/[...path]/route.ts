// /api/office/* -> status, report, command(s), inbox, ack, alerts. See CLAUDE.md "Data contract".
import { office, handle, isLocalRequest } from "@/lib/office/office";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function run(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const text = req.method === "GET" || req.method === "HEAD" ? "" : await req.text();
  if (text.length > 65536) return Response.json({ error: "too large" }, { status: 413 });
  const r = await handle(office, {
    method: req.method, path: url.pathname.replace(/^\/api\/office/, "") || "/", query: url.searchParams,
    headers: req.headers, local: isLocalRequest(req), json: async () => JSON.parse(text || "null"),
  });
  return Response.json(r.body, { status: r.status, headers: { "Cache-Control": "no-store" } });
}
export const GET = run, POST = run, DELETE = run;
