import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { searchContactsForEmail } from "@/lib/sales-model-email";

export const runtime = "nodejs";

/**
 * GET /api/sales-model/email/contacts?q=&limit=
 *
 * Returns up to `limit` (default 12, max 50) contacts that have an
 * email address, scoped to the signed-in agent. Used as the picker
 * data source in the AI Email modal.
 */
export async function GET(req: Request) {
  let agentId: string;
  try {
    const ctx = await getCurrentAgentContext();
    agentId = ctx.agentId;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    return NextResponse.json(
      { ok: false, error: msg },
      { status: msg === "Not authenticated" ? 401 : 500 },
    );
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const limitRaw = Number(url.searchParams.get("limit") ?? "12");
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(Math.trunc(limitRaw), 1), 50)
    : 12;

  const contacts = await searchContactsForEmail(agentId, q, limit);
  return NextResponse.json({ ok: true, contacts });
}
