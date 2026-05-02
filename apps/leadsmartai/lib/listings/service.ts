import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { TransactionStatus } from "@/lib/transactions/types";

/**
 * Listings — the agent's listing-side inventory.
 *
 * Backed by `transactions` rows where `transaction_type` is
 * `listing_rep` or `dual` (dual-rep deals show up on both the buyer
 * and seller sides; we include them here so a dual agent can manage
 * the listing dimension from this surface).
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

const LISTING_TXN_TYPES = ["listing_rep", "dual"] as const;

export type ListingListItem = {
  /** Source transaction id — link to /dashboard/transactions/[id]. */
  transactionId: string;
  property_address: string;
  city: string | null;
  state: string | null;
  status: TransactionStatus;
  /** Asking / agreed price. Schema stores a single `purchase_price` so
   *  for listing-rep deals this is the list price until offer
   *  acceptance, then the agreed price thereafter. */
  list_price: number | null;
  /** RLA signed / listing active. Anchor for listing-rep seed tasks. */
  listing_start_date: string | null;
  /** Scheduled close (under contract) — null until an offer is accepted. */
  closing_date: string | null;
  /** Actual close date — set on COE recording. */
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
  // Listing-rep + dual transactions for this agent. Sort:
  //   1. listing_start_date desc — newest listings first
  //   2. created_at desc       — pre-RLA / draft listings (no
  //      listing_start_date) bubble up by recency
  const { data: txnRows, error } = await supabaseAdmin
    .from("transactions")
    .select(
      "id, property_address, city, state, transaction_type, status, purchase_price, listing_start_date, closing_date, closing_date_actual, created_at",
    )
    .eq("agent_id", agentId)
    .in("transaction_type", LISTING_TXN_TYPES as unknown as string[])
    .order("listing_start_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  if (!txnRows || txnRows.length === 0) return [];

  type Txn = {
    id: string;
    property_address: string;
    city: string | null;
    state: string | null;
    transaction_type: string;
    status: TransactionStatus;
    purchase_price: number | null;
    listing_start_date: string | null;
    closing_date: string | null;
    closing_date_actual: string | null;
    created_at: string;
  };
  const txns = txnRows as Txn[];

  // Roll up showings for these listings in a single batched query.
  const addresses = Array.from(new Set(txns.map((t) => t.property_address)));
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

  return txns.map((t) => {
    const ss = showingsByAddress.get(t.property_address) ?? [];
    let upcoming = 0;
    let lastAt: string | null = null;
    for (const s of ss) {
      if (s.status === "scheduled" && s.scheduled_at >= nowIso) upcoming += 1;
      if (lastAt == null || s.scheduled_at > lastAt) lastAt = s.scheduled_at;
    }
    return {
      transactionId: t.id,
      property_address: t.property_address,
      city: t.city,
      state: t.state,
      status: t.status,
      list_price: t.purchase_price,
      listing_start_date: t.listing_start_date,
      closing_date: t.closing_date,
      closing_date_actual: t.closing_date_actual,
      showings_total: ss.length,
      showings_upcoming: upcoming,
      last_showing_at: lastAt,
    };
  });
}
