import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { getInboundDeliveryForAgent } from "@/lib/inbound/deliveries";

export const runtime = "nodejs";

/**
 * GET /api/dashboard/inbound/[id]
 *
 * Returns the inbound email delivery row for the current agent. Used
 * by the /dashboard/inbound/[id] review page on first paint and by
 * the offer/listing upload pages when they prefill from `inboundId`.
 *
 * 404 (not 403) on cross-agent IDs — we don't want to leak the
 * existence of other agents' delivery IDs to a probing client.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { id } = await ctx.params;
    const delivery = await getInboundDeliveryForAgent(String(agentId), id);
    if (!delivery) {
      return NextResponse.json(
        { ok: false, error: "not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, delivery });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    console.error("GET /api/dashboard/inbound/[id]:", e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
