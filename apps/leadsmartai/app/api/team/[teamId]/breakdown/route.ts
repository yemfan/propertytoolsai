import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { loadTeamBreakdown } from "@/lib/teams/breakdown.server";
import { getRole } from "@/lib/teams/service";

/**
 * Per-member breakdown for one team.
 *
 * Authorized to **team members** (any role) so a member can see how
 * their team is doing relative to peers — same data, shown the same
 * way. The owner-only restriction would be over-tight: this is a
 * "transparency" surface, not a management surface.
 *
 * Returns zero-rows + zero-totals on any failure (DB error,
 * unauthorized) so the UI panel stays renderable.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  try {
    const { teamId } = await params;
    if (!teamId) {
      return NextResponse.json({ ok: false, error: "Missing teamId" }, { status: 400 });
    }

    const ctx = await getCurrentAgentContext();
    const role = await getRole({ teamId, agentId: ctx.agentId });
    if (!role) {
      return NextResponse.json({ ok: false, error: "Not a team member" }, { status: 403 });
    }

    const breakdown = await loadTeamBreakdown(teamId);
    return NextResponse.json({ ok: true, breakdown });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message ?? "Server error" },
      { status: 500 },
    );
  }
}
