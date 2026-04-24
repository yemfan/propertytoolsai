import { NextResponse } from "next/server";
import { requireMobileAgent } from "@/lib/mobile/auth";
import { addCounter, type AddCounterInput } from "@/lib/offers/service";

export const runtime = "nodejs";

/**
 * POST /api/mobile/offers/[id]/counters
 *
 * Records a new counter round. The service auto-increments
 * counter_number and flips the parent offer's status to "countered".
 * Mobile uses this when the listing agent calls back with a counter
 * and the buyer's agent wants to log it on the spot.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as Partial<AddCounterInput>;

    if (!body.direction) {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          error: "direction is required (seller_to_buyer | buyer_to_seller)",
        },
        { status: 400 },
      );
    }

    const counter = await addCounter(auth.ctx.agentId, id, {
      direction: body.direction,
      price: body.price ?? null,
      changedFields: body.changedFields ?? null,
      notes: body.notes ?? null,
    });
    return NextResponse.json({ ok: true, success: true, counter });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("POST /api/mobile/offers/[id]/counters", e);
    const status = msg === "Offer not found" ? 404 : 500;
    return NextResponse.json(
      { ok: false, success: false, error: msg },
      { status },
    );
  }
}
