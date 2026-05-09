import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { TransactionStatus } from "@/lib/transactions/types";
import type {
  ListingDetail,
  ListingListItem,
  ListingStatus,
} from "@/lib/listings/types";

// Re-export so existing server-side imports (`@/lib/listings/service`)
// continue to compile. Client-side consumers should import from
// `@/lib/listings/types` directly to avoid the `server-only` guard.
export type { ListingDetail, ListingListItem, ListingStatus };
export { LISTING_STATUS_LABEL } from "@/lib/listings/types";

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

/**
 * Map listings.status → TransactionStatus to keep the existing
 * badge UI on /dashboard/properties rendering. The mapping is
 * intentionally lossy for terminal states (contracted/withdrawn/
 * expired all collapse to active/terminated) because the legacy UI
 * only knows four states. Detail page uses ListingStatus directly.
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

/**
 * Create a new listing. Phase 2c of the listings/transactions
 * split — listings no longer get inserted into the transactions
 * table. The transactions table only gets a row at offer-accept
 * time (Phase 2d), so a fresh listing has no transaction_id yet.
 *
 * Default status is 'active' rather than 'draft' — when the agent
 * submits the form they've typed enough fields to make this a
 * real listing. Pass `status: 'draft'` explicitly if needed.
 */
export type CreateListingInput = {
  agentId: string | number;
  contactId: string;
  propertyAddress: string;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  mlsNumber?: string | null;
  mlsUrl?: string | null;
  listPrice?: number | null;
  listingStartDate?: string | null;
  listingEndDate?: string | null;
  status?: ListingStatus;
  commissionPct?: number | null;
  notes?: string | null;
};

export async function createListing(
  input: CreateListingInput,
): Promise<ListingDetail> {
  const status: ListingStatus = input.status ?? "active";

  const { data, error } = await supabaseAdmin
    .from("listings")
    .insert({
      agent_id: input.agentId,
      contact_id: input.contactId,
      property_address: input.propertyAddress,
      city: input.city ?? null,
      state: input.state ?? null,
      zip: input.zip ?? null,
      mls_number: input.mlsNumber ?? null,
      mls_url: input.mlsUrl ?? null,
      list_price: input.listPrice ?? null,
      listing_start_date: input.listingStartDate ?? null,
      listing_end_date: input.listingEndDate ?? null,
      status,
      commission_pct: input.commissionPct ?? null,
      notes: input.notes ?? null,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create listing");

  // Re-fetch via getListingById so callers get the full ListingDetail
  // shape with contactName + showings rollup (consistent with the
  // detail page).
  const detail = await getListingById(
    String(input.agentId),
    (data as { id: string }).id,
  );
  if (!detail) throw new Error("Listing was created but could not be re-fetched");
  return detail;
}

/**
 * Generic listing field updates. Used today by the listing detail
 * page to flip status (e.g. → 'contracted' when an offer is accepted)
 * and may grow other field setters as the surface needs them.
 *
 * Returns null when the listing isn't owned by the agent (so the
 * route can render a clean 404). Throws on DB errors.
 */
export type UpdateListingInput = Partial<{
  status: ListingStatus;
  list_price: number | null;
  listing_start_date: string | null;
  listing_end_date: string | null;
  mls_number: string | null;
  mls_url: string | null;
  commission_pct: number | null;
  notes: string | null;
}>;

export async function updateListing(
  agentId: string,
  listingId: string,
  input: UpdateListingInput,
): Promise<ListingDetail | null> {
  // Confirm ownership before touching anything.
  const { data: existing } = await supabaseAdmin
    .from("listings")
    .select("id")
    .eq("id", listingId)
    .eq("agent_id", agentId)
    .maybeSingle();
  if (!existing) return null;

  const { error } = await supabaseAdmin
    .from("listings")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", listingId)
    .eq("agent_id", agentId);
  if (error) throw new Error(error.message);
  return getListingById(agentId, listingId);
}

/**
 * Promote a listing to a post-acceptance transaction.
 *
 * Phase 2d of the listings/transactions split — the lifecycle
 * hand-off. Called when an offer on the listing is accepted (the
 * listing transitions from "active" / "pending" to "contracted")
 * and the agent needs a transaction row to track the
 * post-acceptance phase: escrow, contingencies, closing.
 *
 * Side effects (atomic via two updates — there's no transaction
 * primitive in supabaseAdmin RPC mode, but the failure mode is
 * benign: if the post-spawn listing update fails, the promotion
 * is retryable because we re-check transaction_id before spawning):
 *
 *   1. Insert into transactions:
 *        agent_id, contact_id, property_address, city, state, zip
 *          ← copied from listing
 *        purchase_price ← opts.purchasePrice ?? listing.list_price
 *        mutual_acceptance_date ← opts.mutualAcceptanceDate ?? today
 *        closing_date ← opts.closingDate (optional)
 *        transaction_type ← opts.transactionType ?? 'listing_rep'
 *        source_listing_id ← listing.id   (forward-link)
 *        status ← 'active'
 *        listing_start_date ← listing.listing_start_date
 *
 *   2. Update the listing:
 *        status ← 'contracted'
 *        transaction_id ← new transaction id   (back-link)
 *        updated_at ← now
 *
 * Idempotent: if the listing already has a transaction_id set
 * (i.e. a previous promote call landed and the lifecycle is done),
 * return the existing transaction without creating a new one.
 *
 * @throws when the listing doesn't exist for the agent.
 * @throws when the listing is in a terminal state (withdrawn,
 *         expired) — those listings shouldn't transition to
 *         contracted; the agent needs to relist first.
 */
export async function promoteListingToTransaction(
  agentId: string,
  listingId: string,
  opts?: {
    mutualAcceptanceDate?: string | null;
    closingDate?: string | null;
    purchasePrice?: number | null;
    transactionType?: "listing_rep" | "dual";
  },
): Promise<{ listingId: string; transactionId: string }> {
  const { data: row, error } = await supabaseAdmin
    .from("listings")
    .select(
      "id, agent_id, contact_id, property_address, city, state, zip, list_price, listing_start_date, status, transaction_id",
    )
    .eq("agent_id", agentId)
    .eq("id", listingId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("Listing not found for this agent");
  const listing = row as {
    id: string;
    agent_id: string | number;
    contact_id: string;
    property_address: string;
    city: string | null;
    state: string | null;
    zip: string | null;
    list_price: number | null;
    listing_start_date: string | null;
    status: ListingStatus;
    transaction_id: string | null;
  };

  // Idempotency: if already promoted, return the existing
  // transaction without spawning a duplicate.
  if (listing.transaction_id) {
    return { listingId: listing.id, transactionId: listing.transaction_id };
  }

  if (listing.status === "withdrawn" || listing.status === "expired") {
    throw new Error(
      `Listing is ${listing.status} — relist before marking under contract`,
    );
  }

  const transactionType = opts?.transactionType ?? "listing_rep";
  const today = new Date().toISOString().slice(0, 10);
  const mutualAcceptance = opts?.mutualAcceptanceDate ?? today;
  const purchasePrice = opts?.purchasePrice ?? listing.list_price;

  // 1. Spawn the transaction. Use createTransaction's seedTasks
  //    pipeline so the new row arrives with the listing-rep
  //    checklist populated and deadlines auto-filled from the
  //    mutual_acceptance_date anchor.
  const { createTransaction } = await import("@/lib/transactions/service");
  const txn = await createTransaction({
    agentId: String(listing.agent_id),
    contactId: listing.contact_id,
    transactionType,
    propertyAddress: listing.property_address,
    city: listing.city,
    state: listing.state,
    zip: listing.zip,
    purchasePrice,
    listingStartDate: listing.listing_start_date,
    mutualAcceptanceDate: mutualAcceptance,
    closingDate: opts?.closingDate ?? null,
    notes: null,
  });

  // 2. Set both back-links and flip listing.status. We update
  //    transactions.source_listing_id separately because
  //    createTransaction's input doesn't carry that field
  //    (it's an internal back-link, not a user-facing field).
  await supabaseAdmin
    .from("transactions")
    .update({ source_listing_id: listing.id, updated_at: new Date().toISOString() })
    .eq("id", txn.id)
    .eq("agent_id", agentId);

  await supabaseAdmin
    .from("listings")
    .update({
      transaction_id: txn.id,
      status: "contracted",
      updated_at: new Date().toISOString(),
    })
    .eq("id", listing.id)
    .eq("agent_id", agentId);

  return { listingId: listing.id, transactionId: txn.id };
}

/**
 * Single-listing fetch for the detail page. Returns null if the
 * listing doesn't exist or doesn't belong to the agent (so the page
 * can render a 404 cleanly).
 */
export async function getListingById(
  agentId: string,
  id: string,
): Promise<ListingDetail | null> {
  const { data: row, error } = await supabaseAdmin
    .from("listings")
    .select("*")
    .eq("agent_id", agentId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) return null;

  const r = row as Omit<ListingDetail, "contactName" | "showings_total" | "showings_upcoming" | "last_showing_at">;

  // Resolve seller display name from contacts. Best-effort — falls
  // back to null so the UI renders "—" rather than crashing on a
  // missing/deleted contact.
  let contactName: string | null = null;
  if (r.contact_id) {
    const { data: contactRow } = await supabaseAdmin
      .from("contacts")
      .select("name, first_name, last_name")
      .eq("id", r.contact_id)
      .maybeSingle();
    const c = contactRow as
      | { name: string | null; first_name: string | null; last_name: string | null }
      | null;
    if (c) {
      contactName =
        c.name ??
        [c.first_name, c.last_name].filter(Boolean).join(" ").trim() ??
        null;
    }
  }

  // Showings activity for this property (same matching as the list page).
  const { data: showingRows } = await supabaseAdmin
    .from("showings")
    .select("scheduled_at, status")
    .eq("agent_id", agentId)
    .eq("property_address", r.property_address);
  const showings = (showingRows ?? []) as Array<{ scheduled_at: string; status: string }>;
  const nowIso = new Date().toISOString();
  let upcoming = 0;
  let lastAt: string | null = null;
  for (const s of showings) {
    if (s.status === "scheduled" && s.scheduled_at >= nowIso) upcoming += 1;
    if (lastAt == null || s.scheduled_at > lastAt) lastAt = s.scheduled_at;
  }

  return {
    ...r,
    contactName,
    showings_total: showings.length,
    showings_upcoming: upcoming,
    last_showing_at: lastAt,
  };
}
