import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { getOpportunities } from "@/lib/growth/opportunitiesService";

export const runtime = "nodejs";
// Cold generation takes 10-20s for the Claude call; the default 10s
// would truncate. Cached reads return in milliseconds.
export const maxDuration = 60;

/**
 * GET  /api/dashboard/growth/opportunities
 *   Returns the cached opportunity list (generates on first load).
 *
 * POST /api/dashboard/growth/opportunities
 *   Force-regenerates, bypassing cache. Wired to the "Refresh" button.
 */
export async function GET() {
  try {
    const { agentId } = await getCurrentAgentContext();
    const result = await getOpportunities(String(agentId));
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("GET growth/opportunities:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const { agentId } = await getCurrentAgentContext();
    const result = await getOpportunities(String(agentId), { forceRefresh: true });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("POST growth/opportunities:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
