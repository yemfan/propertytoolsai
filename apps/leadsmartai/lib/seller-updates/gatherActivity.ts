import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  ListingActivitySnapshot,
  VisitorTimeline,
} from "./types";
import type { TransactionRow } from "@/lib/transactions/types";

/**
 * Collects a week-scoped activity snapshot for a single listing.
 * Pure read-only; consumed by the email renderer + Claude commentary
 * prompt.
 *
 * Window semantics:
 *   * `windowStart` defaults to listing.seller_update_last_sent_at or,
 *     if null, 7 days ago. This means the first email after enabling
 *     covers the last week (not all history — that'd be a surprise).
 *   * `windowEnd` = now.
 *
 * Open houses: any OH on this listing (matched by transaction_id) with
 * start_at inside the window. Visitors include everyone who signed in
 * at those events.
 *
 * Offers: listing_offers rows on this transaction, with created_at in
 * the window.
 */
export async function gatherListingActivity(
  transaction: TransactionRow,
  opts?: { nowIso?: string },
): Promise<ListingActivitySnapshot> {
  const nowIso = opts?.nowIso ?? new Date().toISOString();
  const windowStartIso =
    (transaction as { seller_update_last_sent_at?: string | null }).seller_update_last_sent_at ??
    new Date(new Date(nowIso).getTime() - 7 * 86_400_000).toISOString();

  // Days on market — from listing_start_date if present.
  const daysOnMarket = transaction.listing_start_date
    ? daysBetweenIso(transaction.listing_start_date, nowIso.slice(0, 10))
    : null;

  // ── Open-house visitors in window ─────────────────────────────────
  const { data: ohRows } = await supabaseAdmin
    .from("open_houses")
    .select("id, start_at")
    .eq("transaction_id", transaction.id)
    .gte("start_at", windowStartIso)
    .lte("start_at", nowIso);
  const openHousesHeldCount = (ohRows ?? []).length;

  let visitorsTotal = 0;
  let visitorsHot = 0;
  let visitorsAgented = 0;
  let visitorsOptedIn = 0;
  const timelineBreakdown: Record<VisitorTimeline, number> = {
    now: 0,
    "3_6_months": 0,
    "6_12_months": 0,
    later: 0,
    just_looking: 0,
  };
  const noteSnippets: string[] = [];
  let lifetimeVisitors = 0;

  if (openHousesHeldCount > 0) {
    const ohIds = ((ohRows ?? []) as Array<{ id: string }>).map((o) => o.id);
    const { data: visitorRows } = await supabaseAdmin
      .from("open_house_visitors")
      .select(
        "open_house_id, timeline, is_buyer_agented, marketing_consent, notes, created_at",
      )
      .in("open_house_id", ohIds);

    for (const v of (visitorRows ?? []) as Array<{
      timeline: VisitorTimeline | null;
      is_buyer_agented: boolean;
      marketing_consent: boolean;
      notes: string | null;
      created_at: string;
    }>) {
      if (v.created_at >= windowStartIso && v.created_at <= nowIso) {
        visitorsTotal += 1;
        if (v.timeline === "now") visitorsHot += 1;
        if (v.is_buyer_agented) visitorsAgented += 1;
        if (v.marketing_consent) visitorsOptedIn += 1;
        if (v.timeline) timelineBreakdown[v.timeline] += 1;
        if (v.notes && noteSnippets.length < 5) {
          // Anonymize — truncate + strip any obvious PII patterns. For
          // MVP we trust agents not to paste PII into notes. Length cap
          // prevents the prompt from ballooning.
          const snippet = v.notes.trim().slice(0, 160);
          if (snippet.length > 0) noteSnippets.push(snippet);
        }
      }
    }
  }

  // Lifetime visitor count — simple separate query so we don't bloat
  // the in-window join.
  const { data: lifetimeVisitorRows } = await supabaseAdmin
    .from("open_houses")
    .select("id")
    .eq("transaction_id", transaction.id);
  if ((lifetimeVisitorRows ?? []).length > 0) {
    const ohIds = ((lifetimeVisitorRows ?? []) as Array<{ id: string }>).map((o) => o.id);
    const { count } = await supabaseAdmin
      .from("open_house_visitors")
      .select("*", { count: "exact", head: true })
      .in("open_house_id", ohIds);
    lifetimeVisitors = count ?? 0;
  }

  // ── Listing offers in window ──────────────────────────────────────
  const { data: offerRows } = await supabaseAdmin
    .from("listing_offers")
    .select("offer_price, current_price, status, created_at")
    .eq("transaction_id", transaction.id)
    .gte("created_at", windowStartIso)
    .lte("created_at", nowIso);
  const windowOffers = (offerRows ?? []) as Array<{
    offer_price: number;
    current_price: number | null;
    status: string;
    created_at: string;
  }>;

  let offersActiveCount = 0;
  let offersAcceptedCount = 0;
  let offersRejectedCount = 0;
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  for (const o of windowOffers) {
    const p = o.current_price ?? o.offer_price;
    if (p < minPrice) minPrice = p;
    if (p > maxPrice) maxPrice = p;
    if (["submitted", "countered"].includes(o.status)) offersActiveCount += 1;
    if (o.status === "accepted") offersAcceptedCount += 1;
    if (["rejected", "withdrawn", "expired"].includes(o.status)) offersRejectedCount += 1;
  }
  const offersReceivedCount = windowOffers.length;
  const offerPriceRange =
    offersReceivedCount > 0 ? { min: minPrice, max: maxPrice } : null;

  // Lifetime offer count.
  const { count: lifetimeOffers } = await supabaseAdmin
    .from("listing_offers")
    .select("*", { count: "exact", head: true })
    .eq("transaction_id", transaction.id);

  return {
    propertyAddress: transaction.property_address,
    listPrice: transaction.purchase_price, // we use purchase_price as list price on listing_rep
    listingStartDate: transaction.listing_start_date,
    daysOnMarket,
    windowStartIso,
    windowEndIso: nowIso,
    openHousesHeldCount,
    visitorsTotal,
    visitorsHot,
    visitorsAgented,
    visitorsOptedIn,
    visitorTimelineBreakdown: timelineBreakdown,
    visitorNoteSnippets: noteSnippets,
    offersReceivedCount,
    offersActiveCount,
    offersAcceptedCount,
    offersRejectedCount,
    offerPriceRange,
    lifetimeVisitors,
    lifetimeOffers: lifetimeOffers ?? 0,
  };
}

function daysBetweenIso(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.slice(0, 10).split("-").map(Number);
  const [ty, tm, td] = toIso.slice(0, 10).split("-").map(Number);
  const from = Date.UTC(fy, (fm ?? 1) - 1, fd ?? 1);
  const to = Date.UTC(ty, (tm ?? 1) - 1, td ?? 1);
  return Math.max(0, Math.round((to - from) / 86_400_000));
}
