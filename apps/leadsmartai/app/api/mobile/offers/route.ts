import { NextResponse } from "next/server";
import { requireMobileAgent } from "@/lib/mobile/auth";
import {
  createOffer,
  listOffersForAgent,
  type CreateOfferInput,
} from "@/lib/offers/service";
import type { OfferStatus } from "@/lib/offers/types";

export const runtime = "nodejs";

/**
 * GET /api/mobile/offers
 *   Returns { offers } — same shape as dashboard list, denormalized
 *   with contact_name + counter_count.
 *
 * POST /api/mobile/offers
 *   Creates a draft (or submitted, if `submitNow: true`) offer.
 *   Mirrors dashboard POST but with mobile Bearer auth so an agent
 *   can fire one off from a Showing detail page after a positive
 *   tour reaction.
 */

const VALID_STATUS_FILTERS = new Set([
  "draft",
  "submitted",
  "countered",
  "accepted",
  "rejected",
  "withdrawn",
  "expired",
  "active",
  "won",
  "lost",
  "all",
]);

export async function GET(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const url = new URL(req.url);
    const contactId = url.searchParams.get("contactId") || undefined;
    const rawStatus = url.searchParams.get("status");
    const status =
      rawStatus && VALID_STATUS_FILTERS.has(rawStatus)
        ? (rawStatus as OfferStatus | "active" | "won" | "lost" | "all")
        : undefined;
    const offers = await listOffersForAgent(auth.ctx.agentId, { contactId, status });
    return NextResponse.json({ ok: true, success: true, offers });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("GET /api/mobile/offers", e);
    return NextResponse.json(
      { ok: false, success: false, error: msg },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = (await req.json().catch(() => ({}))) as Partial<CreateOfferInput>;

    if (!body.contactId || !body.propertyAddress || body.offerPrice == null) {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          error: "contactId, propertyAddress, and offerPrice are required.",
        },
        { status: 400 },
      );
    }

    const created = await createOffer({
      agentId: auth.ctx.agentId,
      contactId: String(body.contactId),
      propertyAddress: String(body.propertyAddress),
      offerPrice: Number(body.offerPrice),
      showingId: body.showingId ?? null,
      city: body.city ?? null,
      state: body.state ?? null,
      zip: body.zip ?? null,
      mlsNumber: body.mlsNumber ?? null,
      mlsUrl: body.mlsUrl ?? null,
      listPrice: body.listPrice ?? null,
      earnestMoney: body.earnestMoney ?? null,
      downPayment: body.downPayment ?? null,
      financingType: body.financingType ?? null,
      closingDateProposed: body.closingDateProposed ?? null,
      inspectionContingency: body.inspectionContingency,
      appraisalContingency: body.appraisalContingency,
      loanContingency: body.loanContingency,
      contingencyNotes: body.contingencyNotes ?? null,
      offerExpiresAt: body.offerExpiresAt ?? null,
      notes: body.notes ?? null,
      submitNow: body.submitNow,
    });

    return NextResponse.json({ ok: true, success: true, offer: created });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("POST /api/mobile/offers", e);
    return NextResponse.json(
      { ok: false, success: false, error: msg },
      { status: 500 },
    );
  }
}
