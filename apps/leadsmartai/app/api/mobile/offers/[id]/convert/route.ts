import { NextResponse } from "next/server";
import { requireMobileAgent } from "@/lib/mobile/auth";
import { convertOfferToTransaction } from "@/lib/offers/service";

export const runtime = "nodejs";

/**
 * POST /api/mobile/offers/[id]/convert
 *
 * Creates a buyer-rep transaction from an accepted offer and
 * back-links both rows. Mobile uses this so an agent can move an
 * accepted offer into the deal pipeline from the field — the
 * transaction screen is web-only for now, but the row is created
 * here and the agent can finish editing on desktop.
 *
 * Body is optional; `{ mutualAcceptanceDate: "YYYY-MM-DD" }`
 * overrides the default (offer.accepted_at).
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as {
      mutualAcceptanceDate?: string | null;
    };
    const transaction = await convertOfferToTransaction(auth.ctx.agentId, id, {
      mutualAcceptanceDate: body.mutualAcceptanceDate ?? null,
    });
    return NextResponse.json({ ok: true, success: true, transaction });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("POST /api/mobile/offers/[id]/convert", e);
    const status =
      msg === "Offer not found"
        ? 404
        : /accepted|already been converted/i.test(msg)
          ? 400
          : 500;
    return NextResponse.json(
      { ok: false, success: false, error: msg },
      { status },
    );
  }
}
