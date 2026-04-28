import { NextResponse } from "next/server";

import { getCurrentAgentContext } from "@/lib/dashboardService";
import { getCoordinatorBoardForAgent } from "@/lib/transactions/coordinator/service";

export const runtime = "nodejs";

/**
 * GET /api/dashboard/transactions/coordinator
 *
 * Returns the kanban board for the agent's in-flight transactions —
 * 5 stage columns + per-card per-stage metrics + page-level totals.
 * RLS isn't load-bearing here because the service layer scopes every
 * query to `agent_id`, but the table-level policies are still enforced
 * downstream as defense-in-depth.
 */
export async function GET() {
  try {
    const { agentId } = await getCurrentAgentContext();
    const board = await getCoordinatorBoardForAgent(String(agentId));
    return NextResponse.json({ ok: true, board });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
