// GET /office -> the Agent Office page (self-contained HTML; it polls /api/office/*).
import { officePage, isLocalRequest } from "@/lib/office/office";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isLocalRequest(req)) return new Response("local only", { status: 403 });
  return new Response(await officePage(), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
