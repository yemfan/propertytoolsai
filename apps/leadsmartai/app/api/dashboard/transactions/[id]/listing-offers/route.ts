import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import {
  createListingOffer,
  listOffersForTransaction,
  type CreateListingOfferInput,
} from "@/lib/listing-offers/service";

export const runtime = "nodejs";

/**
 * GET  /api/dashboard/transactions/[id]/listing-offers
 *   Returns all listing offers on a single listing transaction, enriched
 *   for the compare view (counter counts, contingency counts, is_cash).
 *
 * POST /api/dashboard/transactions/[id]/listing-offers
 *   Creates a new listing offer against the transaction. Body mirrors
 *   CreateListingOfferInput sans agentId/transactionId.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { id } = await ctx.params;
    const offers = await listOffersForTransaction(String(agentId), id);
    return NextResponse.json({ ok: true, offers });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    const status = /not found|only be added/i.test(message) ? 404 : 500;
    console.error("GET listing-offers:", err);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as Partial<CreateListingOfferInput>;

    if (body.offerPrice == null) {
      return NextResponse.json(
        { ok: false, error: "offerPrice is required." },
        { status: 400 },
      );
    }

    const created = await createListingOffer({
      agentId: String(agentId),
      transactionId: id,
      offerPrice: Number(body.offerPrice),
      buyerName: body.buyerName ?? null,
      buyerBrokerage: body.buyerBrokerage ?? null,
      buyerAgentName: body.buyerAgentName ?? null,
      buyerAgentEmail: body.buyerAgentEmail ?? null,
      buyerAgentPhone: body.buyerAgentPhone ?? null,
      earnestMoney: body.earnestMoney ?? null,
      downPayment: body.downPayment ?? null,
      financingType: body.financingType ?? null,
      closingDateProposed: body.closingDateProposed ?? null,
      inspectionContingency: body.inspectionContingency,
      appraisalContingency: body.appraisalContingency,
      loanContingency: body.loanContingency,
      saleOfHomeContingency: body.saleOfHomeContingency,
      contingencyNotes: body.contingencyNotes ?? null,
      sellerConcessions: body.sellerConcessions ?? null,
      offerExpiresAt: body.offerExpiresAt ?? null,
      notes: body.notes ?? null,
    });

    return NextResponse.json({ ok: true, offer: created });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    const status = /not found|only be added/i.test(message) ? 404 : 500;
    console.error("POST listing-offers:", err);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
