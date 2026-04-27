import { NextResponse } from "next/server";

import { getCoachingDashboard } from "@/lib/coaching/service";
import { getCurrentAgentContext } from "@/lib/dashboardService";

export const runtime = "nodejs";

/**
 * GET /api/dashboard/coaching
 *
 * Returns the agent's current coaching insights — sorted crit > warn >
 * info. Builders that produce no insight (because the underlying
 * condition isn't met) are simply absent from the list.
 */
export async function GET() {
  try {
    const { agentId } = await getCurrentAgentContext();
    const data = await getCoachingDashboard(String(agentId));
    return NextResponse.json({ ok: true, ...data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
