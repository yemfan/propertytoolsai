import { NextResponse } from "next/server";
import { requireMobileAgent } from "@/lib/mobile/auth";
import {
  getOfferWithCounters,
  updateOffer,
  type UpdateOfferInput,
} from "@/lib/offers/service";

export const runtime = "nodejs";

/**
 * GET /api/mobile/offers/[id]
 *   Returns { offer, counters, contactName }.
 *
 * PATCH /api/mobile/offers/[id]
 *   Body subset of UpdateOfferInput. Used by mobile to flip status
 *   (submitted → accepted, etc.), edit price, contingencies, notes.
 *   Same shape as the dashboard PATCH; service layer stamps
 *   submitted_at / accepted_at / closed_at on transitions.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const { id } = await ctx.params;
    const result = await getOfferWithCounters(auth.ctx.agentId, id);
    if (!result) {
      return NextResponse.json(
        { ok: false, success: false, error: "Not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, success: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("GET /api/mobile/offers/[id]", e);
    return NextResponse.json(
      { ok: false, success: false, error: msg },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as UpdateOfferInput;
    const updated = await updateOffer(auth.ctx.agentId, id, body);
    if (!updated) {
      return NextResponse.json(
        { ok: false, success: false, error: "Not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, success: true, offer: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("PATCH /api/mobile/offers/[id]", e);
    return NextResponse.json(
      { ok: false, success: false, error: msg },
      { status: 500 },
    );
  }
}
