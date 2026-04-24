import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { getOpportunities } from "@/lib/growth/opportunitiesService";
import { canUseAiAction } from "@/lib/entitlements/accessResult";
import { consumeAiToken } from "@/lib/entitlements/consumeAiToken";

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
    const { agentId, userId } = await getCurrentAgentContext();
    const result = await getOpportunities(String(agentId));
    // Opportunities service caches for ~1h. If the returned object
    // wasn't cached (first call of the hour), charge an AI action.
    // The service exposes `fromCache` on the result envelope.
    const fromCache =
      typeof (result as { fromCache?: boolean }).fromCache === "boolean"
        ? (result as { fromCache: boolean }).fromCache
        : true;
    if (!fromCache) {
      try {
        await consumeAiToken(userId);
      } catch (usageErr) {
        console.warn("[growth/opportunities GET] usage increment failed:", usageErr);
      }
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("GET growth/opportunities:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const { agentId, userId } = await getCurrentAgentContext();

    // Force-refresh is an explicit AI call — pre-check the quota.
    const check = await canUseAiAction(userId);
    if (!check.allowed) {
      return NextResponse.json(
        { ok: false, error: "AI action limit reached", result: check },
        { status: 403 },
      );
    }

    const result = await getOpportunities(String(agentId), { forceRefresh: true });
    try {
      await consumeAiToken(userId);
    } catch (usageErr) {
      console.warn("[growth/opportunities POST] usage increment failed:", usageErr);
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("POST growth/opportunities:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
