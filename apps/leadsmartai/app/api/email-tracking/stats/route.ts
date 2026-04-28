import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { getAgentEvents } from "@/lib/email-tracking/service";
import { computeEmailStats } from "@/lib/email-tracking/stats";
import { getAgentScopeForAgent } from "@/lib/teams/scope.server";

/**
 * Email engagement stats for the calling agent over a rolling
 * window (default 30 days). Aggregates rows from `email_events`
 * (populated by /api/webhooks/resend) into the cards-ready shape:
 * sent / delivered / opened / clicked / bounced + open & CTR.
 *
 * Team-aware: when the caller owns a team, stats roll up across
 * the entire roster's outbound email — same scope helper used by
 * the performance summary.
 *
 * Failure mode: returns zeros rather than 5xx so the dashboard
 * card is always renderable.
 */
export async function GET(req: Request) {
  try {
    const ctx = await getCurrentAgentContext();
    const url = new URL(req.url);
    const days = clampDays(url.searchParams.get("days"));
    const sinceIso = new Date(Date.now() - days * 86_400_000).toISOString();

    const scope = await getAgentScopeForAgent(ctx.agentId);
    const eventLists = await Promise.all(
      scope.agentIds.map((id) => getAgentEvents(id, { sinceIso, limit: 5000 })),
    );
    const events = eventLists.flat();
    const stats = computeEmailStats(events);

    return NextResponse.json({
      ok: true,
      days,
      stats,
      scope: {
        kind: scope.scope,
        teamId: scope.primaryTeamId,
        agentCount: scope.agentIds.length,
      },
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        stats: {
          sent: 0,
          delivered: 0,
          opened: 0,
          clicked: 0,
          bounced: 0,
          openRate: 0,
          clickThroughRate: 0,
        },
        error: (e as Error).message,
      },
      { status: 200 },
    );
  }
}

function clampDays(raw: string | null): number {
  const n = Number(raw ?? 30);
  if (!Number.isFinite(n)) return 30;
  return Math.min(Math.max(Math.round(n), 1), 90);
}
