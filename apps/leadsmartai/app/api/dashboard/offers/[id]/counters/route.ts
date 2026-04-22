import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { addCounter, type AddCounterInput } from "@/lib/offers/service";

export const runtime = "nodejs";

/**
 * POST /api/dashboard/offers/[id]/counters
 *
 * Records a new counter round. The service auto-increments counter_number
 * and flips the parent offer's status to "countered".
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as Partial<AddCounterInput>;

    if (!body.direction) {
      return NextResponse.json(
        { ok: false, error: "direction is required (seller_to_buyer | buyer_to_seller)" },
        { status: 400 },
      );
    }

    const counter = await addCounter(String(agentId), id, {
      direction: body.direction,
      price: body.price ?? null,
      changedFields: body.changedFields ?? null,
      notes: body.notes ?? null,
    });
    return NextResponse.json({ ok: true, counter });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("POST offers/[id]/counters:", err);
    const status = message === "Offer not found" ? 404 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
