import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { listRecentCalls } from "@/lib/missed-call/service";

export const runtime = "nodejs";

/**
 * GET /api/dashboard/missed-call/events?limit=
 *
 * Returns the recent call_logs rows for the agent (inbound +
 * outbound, all statuses) with contact names resolved. The settings
 * page renders this as an activity feed showing missed calls and
 * whether the auto-text-back fired for each.
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
  const limitRaw = Number(url.searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(Math.trunc(limitRaw), 1), 200)
    : 50;

  const events = await listRecentCalls(agentId, limit);
  return NextResponse.json({ ok: true, events });
}
