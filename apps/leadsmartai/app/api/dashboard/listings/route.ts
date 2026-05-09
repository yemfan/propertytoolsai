import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import {
  createListing,
  type CreateListingInput,
} from "@/lib/listings/service";

export const runtime = "nodejs";

/**
 * POST /api/dashboard/listings
 *
 * Creates a new listing in the dedicated `listings` table (Phase 2c
 * of the listings/transactions split). Replaces the previous flow
 * where the new-transaction form posted to /api/dashboard/transactions
 * with `transaction_type='listing_rep'` — listings now live in
 * their own table from the moment they're created.
 *
 * Body shape mirrors CreateListingInput minus `agentId` (we resolve
 * that from the session).
 *
 * 400 when contactId or propertyAddress are missing.
 * Returns the freshly-created listing's full detail shape.
 */
export async function POST(req: Request) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const body = (await req.json().catch(() => ({}))) as Partial<
      Omit<CreateListingInput, "agentId">
    >;

    if (!body.contactId || !body.propertyAddress) {
      return NextResponse.json(
        { ok: false, error: "contactId and propertyAddress are required." },
        { status: 400 },
      );
    }

    const listing = await createListing({
      agentId,
      contactId: String(body.contactId),
      propertyAddress: String(body.propertyAddress),
      city: body.city ?? null,
      state: body.state ?? null,
      zip: body.zip ?? null,
      mlsNumber: body.mlsNumber ?? null,
      mlsUrl: body.mlsUrl ?? null,
      listPrice: body.listPrice ?? null,
      listingStartDate: body.listingStartDate ?? null,
      listingEndDate: body.listingEndDate ?? null,
      status: body.status,
      commissionPct: body.commissionPct ?? null,
      notes: body.notes ?? null,
    });

    return NextResponse.json({ ok: true, listing });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("POST /api/dashboard/listings:", err);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
