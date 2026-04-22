import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import {
  addListingOfferCounter,
  type AddCounterInput,
} from "@/lib/listing-offers/service";

export const runtime = "nodejs";

/**
 * POST /api/dashboard/listing-offers/[id]/counters
 *
 * Records a new counter round on a listing offer. Service
 * auto-increments counter_number + flips parent status to "countered"
 * + updates current_price if the counter carries a new price.
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

    const counter = await addListingOfferCounter(String(agentId), id, {
      direction: body.direction,
      price: body.price ?? null,
      changedFields: body.changedFields ?? null,
      notes: body.notes ?? null,
    });
    return NextResponse.json({ ok: true, counter });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    const status = /not found/i.test(message) ? 404 : 500;
    console.error("POST listing-offers/[id]/counters:", err);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
