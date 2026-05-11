import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import {
  createListingOffer,
  type CreateListingOfferInput,
} from "@/lib/listing-offers/service";

export const runtime = "nodejs";

/**
 * POST /api/dashboard/listings/[id]/offers
 *
 * Records a buyer's offer received against a listing. The newer
 * sister-route to POST /api/dashboard/transactions/[id]/listing-offers
 * — which is still the path the legacy /dashboard/transactions/[id]/
 * offers comparison page uses. This one wires the offer to the
 * listing directly via listing_offers.listing_id (Phase 1+ column),
 * leaving listing_offers.transaction_id null until the listing is
 * promoted to a transaction.
 *
 * Body:
 *   {
 *     offerPrice: number,           // required
 *     buyerName?: string | null,
 *     earnestMoney?: number | null,
 *     downPayment?: number | null,
 *     financingType?: FinancingType | null,
 *     closingDateProposed?: "YYYY-MM-DD",
 *     inspectionContingency?: boolean,
 *     appraisalContingency?: boolean,
 *     loanContingency?: boolean,
 *     saleOfHomeContingency?: boolean,
 *     contingencyNotes?: string | null,
 *     sellerConcessions?: number | null,
 *     offerExpiresAt?: ISO timestamp,
 *     notes?: string | null,
 *     // … plus any of buyerBrokerage, buyerAgentName/Email/Phone
 *   }
 *
 * Returns: { ok, offer }
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as Partial<
      Omit<CreateListingOfferInput, "agentId" | "transactionId" | "listingId">
    >;

    if (body.offerPrice == null || !Number.isFinite(Number(body.offerPrice))) {
      return NextResponse.json(
        { ok: false, error: "offerPrice is required and must be numeric." },
        { status: 400 },
      );
    }

    const offer = await createListingOffer({
      agentId: String(agentId),
      listingId: id,
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
      buyerCommissionPct: body.buyerCommissionPct ?? null,
      offerExpiresAt: body.offerExpiresAt ?? null,
      notes: body.notes ?? null,
    });

    return NextResponse.json({ ok: true, offer });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("POST /api/dashboard/listings/[id]/offers:", err);
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
