import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { TransactionStatus } from "@/lib/transactions/types";

/**
 * Listings — the agent's listing-side inventory.
 *
 * Phase 2a of the listings/transactions split (see
 * apps/leadsmartai/docs/LISTINGS_TABLE_SPLIT_DESIGN.md): this
 * service now reads from the dedicated `listings` table instead of
 * `transactions WHERE transaction_type IN ('listing_rep','dual')`.
 *
 * The return shape is *almost* unchanged so /dashboard/properties
 * and downstream consumers don't notice the cutover. Two things to
 * be aware of:
 *
 *   1. `transactionId` is now the *back-link* from listings to its
 *      source transaction. It's populated for every backfilled row
 *      (Phase 1) but will be NULL for new listings created via
 *      Phase 2c onward — so callers that link into
 *      /dashboard/transactions/<id> need to handle null. Phase 2b
 *      replaces the link target with /dashboard/listings/<id>.
 *
 *   2. The listings table has its own status enum (draft / active /
 *      pending / contracted / withdrawn / expired). For backwards
 *      compat we map those to the legacy 4-state TransactionStatus
 *      so the existing badge UI keeps rendering. Phase 2b will land
 *      a ListingStatus type and update the UI labels.
 *
 * Each listing carries showings activity rolled up from the
 * `showings` table by `property_address`. Match is exact — case +
 * whitespace sensitive — because property addresses in this codebase
 * are normalized at write time. Cross-agent showings (a buyer's agent
 * tracking a visit to this listing) are NOT counted; we only see the
 * listing agent's own showings rows. That's a real gap (a listing
 * agent often wants to know "how many buyer agents booked a showing
 * on my listing this week"), but the cross-agent visibility model
 * doesn't exist yet — flagged for follow-up rather than papered over.
 */

/** Status enum on the listings table. Six values vs TransactionStatus's four. */
type ListingStatus =
  | "draft"
  | "active"
  | "pending"
  | "contracted"
  | "withdrawn"
  | "expired";

/**
 * Map listings.status → TransactionStatus to keep the existing
 * badge UI rendering until Phase 2b ships a proper ListingStatus
 * type. The mapping is intentionally lossy for terminal states
 * (contracted/withdrawn/expired all collapse to closed/terminated)
 * because the UI only knows four states. Phase 2b restores fidelity.
 */
function mapStatus(s: ListingStatus): TransactionStatus {
  switch (s) {
    case "draft":
    case "active":
      return "active";
    case "pending":
      return "pending";
    case "contracted":
      return "active"; // under contract — still an active deal
    case "withdrawn":
    case "expired":
      return "terminated";
  }
}

export type ListingListItem = {
  /** Listings table primary key — the new canonical identifier. */
  id: string;
  /**
   * Back-link to the listing's source transaction. Populated for
   * Phase 1-backfilled rows; null for listings created post-Phase 2c.
   * Kept here so existing /dashboard/transactions/<id> links continue
   * working until Phase 2b swaps them to /dashboard/listings/<id>.
   */
  transactionId: string | null;
  property_address: string;
  city: string | null;
  state: string | null;
  status: TransactionStatus;
  /** Asking price from listings.list_price. */
  list_price: number | null;
  /** RLA signed / listing active. Anchor for listing-side seed tasks. */
  listing_start_date: string | null;
  /**
   * Closing fields no longer live on the listing in the new model
   * (closing belongs to the post-acceptance transaction). For the
   * dual-write window we surface these via the back-linked
   * transaction so the existing UI keeps working without churn.
   */
  closing_date: string | null;
  closing_date_actual: string | null;
  /** Total showings the agent has tracked for this property. */
  showings_total: number;
  /** Subset of `showings_total` with status='scheduled' and scheduled_at >= now. */
  showings_upcoming: number;
  /** Most recent scheduled_at (any status), null when no showings yet. */
  last_showing_at: string | null;
};

export async function listListingsForAgent(
  agentId: string,
): Promise<ListingListItem[]> {
  // Listings, sorted newest-first. Listings with no
  // listing_start_date (drafts) bubble up by created_at.
  const { data: listingRows, error } = await supabaseAdmin
    .from("listings")
    .select(
      "id, transaction_id, property_address, city, state, status, list_price, listing_start_date, created_at",
    )
    .eq("agent_id", agentId)
    .order("listing_start_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  if (!listingRows || listingRows.length === 0) return [];

  type Listing = {
    id: string;
    transaction_id: string | null;
    property_address: string;
    city: string | null;
    state: string | null;
    status: ListingStatus;
    list_price: number | null;
    listing_start_date: string | null;
    created_at: string;
  };
  const listings = listingRows as Listing[];

  // Closing fields still live on the back-linked transaction during
  // dual-write. Fetch them in one batched query for any listings that
  // have a transaction_id. Phase 3 deletes this lookup once closing
  // moves fully onto the transaction (and the UI references it from
  // there directly).
  const txnIds = listings
    .map((l) => l.transaction_id)
    .filter((id): id is string => id != null);
  type ClosingRow = {
    id: string;
    closing_date: string | null;
    closing_date_actual: string | null;
  };
  let closingByTxn = new Map<string, ClosingRow>();
  if (txnIds.length > 0) {
    const { data: txnRows, error: txnErr } = await supabaseAdmin
      .from("transactions")
      .select("id, closing_date, closing_date_actual")
      .in("id", txnIds);
    if (txnErr) throw new Error(txnErr.message);
    closingByTxn = new Map(
      ((txnRows ?? []) as ClosingRow[]).map((r) => [r.id, r]),
    );
  }

  // Roll up showings for these listings in a single batched query.
  const addresses = Array.from(new Set(listings.map((l) => l.property_address)));
  type ShowingMin = {
    property_address: string | null;
    scheduled_at: string;
    status: string;
  };
  let showings: ShowingMin[] = [];
  if (addresses.length > 0) {
    const { data: showingRows, error: showingsErr } = await supabaseAdmin
      .from("showings")
      .select("property_address, scheduled_at, status")
      .eq("agent_id", agentId)
      .in("property_address", addresses);
    if (showingsErr) throw new Error(showingsErr.message);
    showings = (showingRows ?? []) as ShowingMin[];
  }

  const showingsByAddress = new Map<string, ShowingMin[]>();
  for (const s of showings) {
    const key = s.property_address ?? "";
    if (!key) continue;
    const list = showingsByAddress.get(key) ?? [];
    list.push(s);
    showingsByAddress.set(key, list);
  }

  const nowIso = new Date().toISOString();

  return listings.map((l) => {
    const ss = showingsByAddress.get(l.property_address) ?? [];
    let upcoming = 0;
    let lastAt: string | null = null;
    for (const s of ss) {
      if (s.status === "scheduled" && s.scheduled_at >= nowIso) upcoming += 1;
      if (lastAt == null || s.scheduled_at > lastAt) lastAt = s.scheduled_at;
    }
    const closing = l.transaction_id ? closingByTxn.get(l.transaction_id) : null;
    return {
      id: l.id,
      transactionId: l.transaction_id,
      property_address: l.property_address,
      city: l.city,
      state: l.state,
      status: mapStatus(l.status),
      list_price: l.list_price,
      listing_start_date: l.listing_start_date,
      closing_date: closing?.closing_date ?? null,
      closing_date_actual: closing?.closing_date_actual ?? null,
      showings_total: ss.length,
      showings_upcoming: upcoming,
      last_showing_at: lastAt,
    };
  });
}
