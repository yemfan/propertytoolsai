import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { cancelRecurrenceSeries } from "@/lib/open-houses/service";

export const runtime = "nodejs";

/**
 * POST /api/dashboard/open-houses/[id]/cancel-series
 *   Marks this occurrence and all future ones in the same recurrence
 *   group as `cancelled`. Past + completed occurrences are left alone.
 *   No-op if the given id is not part of a recurrence group.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { id } = await ctx.params;
    const result = await cancelRecurrenceSeries(String(agentId), id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("POST open-houses/[id]/cancel-series:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
