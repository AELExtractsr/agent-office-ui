// Agent Office: singleton + roster adapter for the Next app. Copy office/server/office-core.mjs and
// office/dist/office-html.mjs next to this file (see CLAUDE.md step 2).
// @ts-ignore - plain ESM module, no types needed
import { createOffice, handle, renderPage, loadRoster } from "./office-core.mjs";
// @ts-ignore - generated string module
import OFFICE_HTML from "./office-html.mjs";

export type Shape = "circle" | "square" | "rounded" | "hexagon" | "triangle" | "diamond" | "star" | "pill";
export interface RosterBot { id: string; name: string; short?: string; role?: string; color: string; shape: Shape; aliases?: string[]; primary?: boolean; desk?: number; idleNote?: string }

const g = globalThis as unknown as { __agentOffice?: ReturnType<typeof createOffice> };
export const office = (g.__agentOffice ??= createOffice()); // survives dev hot-reload

/** Roster for the office. TODO (integration): map the OS agent list here (name, color, shape/icon) — see CLAUDE.md "Roster".
 *  Falls back to roster.json in the project root. */
export async function getRoster(): Promise<{ title?: string; bots: RosterBot[] }> {
  // Example once wired:  const agents = await listAgents();  return { bots: agents.map(a => ({ id: a.id, name: a.name, color: a.color, shape: toShape(a.shape) })) };
  return loadRoster();
}

export async function officePage(): Promise<string> {
  const r = await getRoster();
  return renderPage(OFFICE_HTML, { title: process.env.OFFICE_TITLE || r.title || "Agent Office", apiBase: "/api/office", roster: r.bots });
}

export function isLocalRequest(req: Request): boolean {
  const host = (req.headers.get("host") || "").replace(/:\d+$/, "");
  return ["127.0.0.1", "localhost", "[::1]"].includes(host) && !req.headers.get("x-forwarded-for");
}

export { handle };
