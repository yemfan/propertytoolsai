import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { getRevenueSummary, type RevenuePeriod } from "@/lib/performance/revenueService";

export const runtime = "nodejs";

/**
 * GET /api/performance/revenue?period=ytd|12m|all
 *
 * Returns the revenue + commission rollup for the authed agent.
 * Called from the /dashboard/performance client on mount + period change.
 */
export async function GET(req: Request) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const url = new URL(req.url);
    const rawPeriod = url.searchParams.get("period");
    const period: RevenuePeriod =
      rawPeriod === "12m" || rawPeriod === "all" ? rawPeriod : "ytd";

    const summary = await getRevenueSummary(String(agentId), period);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("GET /api/performance/revenue:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
