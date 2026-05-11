"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  LISTING_STATUS_LABEL,
  type ListingDetail,
  type ListingStatus,
} from "@/lib/listings/types";
import type {
  ListingOfferCompareItem,
  ListingOfferStatus,
} from "@/lib/listing-offers/types";

const OFFER_STATUS_LABEL: Record<ListingOfferStatus, string> = {
  submitted: "Submitted",
  countered: "Countered",
  accepted: "Accepted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  expired: "Expired",
};

const OFFER_STATUS_BADGE: Record<ListingOfferStatus, string> = {
  submitted: "bg-blue-100 text-blue-800",
  countered: "bg-amber-100 text-amber-800",
  accepted: "bg-green-100 text-green-800",
  rejected: "bg-rose-100 text-rose-800",
  withdrawn: "bg-slate-100 text-slate-600",
  expired: "bg-slate-100 text-slate-600",
};

const STATUS_BADGE: Record<ListingStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  active: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  contracted: "bg-blue-100 text-blue-800",
  withdrawn: "bg-slate-100 text-slate-600",
  expired: "bg-slate-100 text-slate-600",
};

/**
 * Sort criteria for the offers list. Six modes a seller actually
 * thinks in when comparing offers:
 *
 *   price-desc       — highest current_price first (default; this is
 *                      what most sellers want when they open the page)
 *   price-asc        — lowest first (rare, but useful for spotting
 *                      lowball wedges)
 *   closing-asc      — earliest proposed closing first (sellers in
 *                      a hurry want the fastest close)
 *   strength         — "cleanest" terms first. Cash beats financed;
 *                      ties break on fewest contingencies, then on
 *                      higher price. Captures the gut-feel ranking
 *                      a listing agent gives a seller.
 *   contingencies-asc — fewest contingencies first (similar to
 *                      strength but ignores cash + price tiebreakers)
 *   newest           — created_at desc — handy when a fresh offer
 *                      just came in and the agent wants to see it
 *                      at the top regardless of price
 */
type OfferSort =
  | "price-desc"
  | "price-asc"
  | "closing-asc"
  | "strength"
  | "contingencies-asc"
  | "newest";

const OFFER_SORT_OPTIONS: Array<{ value: OfferSort; label: string }> = [
  { value: "price-desc", label: "Price · high → low" },
  { value: "price-asc", label: "Price · low → high" },
  { value: "closing-asc", label: "Closing · soonest first" },
  { value: "strength", label: "Strength (cash + fewest contingencies)" },
  { value: "contingencies-asc", label: "Contingencies · fewest first" },
  { value: "newest", label: "Newest first" },
];

/**
 * Sort comparator factory. `current_price` is the negotiated price
 * (counters can shift it from offer_price) — use it for price sort
 * when present, falling back to offer_price.
 *
 * Null-safe: missing prices sort last in price-asc, first in
 * price-desc (treated as +Infinity / -Infinity respectively).
 * Same pattern for closing date.
 */
function sortedOffers<T extends ListingOfferCompareItem>(
  rows: T[],
  by: OfferSort,
): T[] {
  const next = [...rows];
  const priceOf = (o: T) => o.current_price ?? o.offer_price ?? 0;
  next.sort((a, b) => {
    switch (by) {
      case "price-desc":
        return priceOf(b) - priceOf(a);
      case "price-asc":
        return priceOf(a) - priceOf(b);
      case "closing-asc": {
        const da = a.closing_date_proposed
          ? Date.parse(a.closing_date_proposed)
          : Number.POSITIVE_INFINITY;
        const db = b.closing_date_proposed
          ? Date.parse(b.closing_date_proposed)
          : Number.POSITIVE_INFINITY;
        return da - db;
      }
      case "strength": {
        // Cash beats anything financed.
        if (a.is_cash !== b.is_cash) return a.is_cash ? -1 : 1;
        // Then fewer contingencies.
        if (a.contingency_count !== b.contingency_count) {
          return a.contingency_count - b.contingency_count;
        }
        // Then higher price.
        return priceOf(b) - priceOf(a);
      }
      case "contingencies-asc":
        return a.contingency_count - b.contingency_count;
      case "newest":
        return b.created_at.localeCompare(a.created_at);
    }
  });
  return next;
}

function formatMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const days = Math.round((Date.now() - then) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 0) return formatDate(iso);
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/**
 * Listing detail page. Intentionally focused — surfaces the listing-
 * side essentials (property, status, dates, showings) and links into
 * the back-linked transaction for the post-acceptance lifecycle (escrow,
 * contingencies, closing).
 *
 * Phase 2b of the listings/transactions split. Compared to the legacy
 * /dashboard/transactions/[id] view this page:
 *
 *   - Reads from listings, not transactions
 *   - Uses the 6-state ListingStatus enum directly (no mapping)
 *   - Doesn't render contingency/escrow timelines (those belong to the
 *     contracted-deal view, reachable via the "Open contracted deal"
 *     link below the status badge)
 *
 * Phase 2c will add edit affordances (status changes, list-price
 * updates, etc.). For now this is read-only.
 */
export function ListingDetailClient({
  listing,
  offers: initialOffers,
}: {
  listing: ListingDetail;
  offers: ListingOfferCompareItem[];
}) {
  const router = useRouter();
  const cityState = [listing.city, listing.state].filter(Boolean).join(", ");
  const fullLocation = [cityState, listing.zip].filter(Boolean).join(" ");

  const [promoting, setPromoting] = useState(false);
  const [promoteError, setPromoteError] = useState<string | null>(null);

  // Add-offer flow was inline here in an earlier iteration but
  // grew too cramped for the field set sellers need to compare
  // offers (contingencies, financing terms, commission, timing,
  // PDF upload). Moved to /dashboard/listings/[id]/offers/new
  // — the "+ Add offer" button on this page is now a Link.

  // Offers list — per-row action state. The list can update
  // optimistically without a full router.refresh() so the agent
  // doesn't see a flicker when accepting / declining / countering.
  // Each action keys its in-flight pending state by `${offerId}:${kind}`
  // so two rows can be acted on independently.
  const [offers, setOffers] = useState<ListingOfferCompareItem[]>(initialOffers);
  /** Sort criterion for the offers list. Sellers comparing
   *  multiple offers want to slice this differently — by money
   *  (price desc), by speed (closing date asc), or by "cleanest"
   *  terms (fewest contingencies, cash first). */
  const [sortBy, setSortBy] = useState<OfferSort>("price-desc");
  const [pendingOfferAction, setPendingOfferAction] = useState<string | null>(null);
  const [offerActionError, setOfferActionError] = useState<string | null>(null);
  // Inline counter form — keyed by offerId so only one offer's
  // counter form is open at a time.
  const [counterFormForOfferId, setCounterFormForOfferId] = useState<string | null>(null);
  const [counterPrice, setCounterPrice] = useState("");
  const [counterNotes, setCounterNotes] = useState("");

  async function declineOffer(offerId: string) {
    setPendingOfferAction(`${offerId}:decline`);
    setOfferActionError(null);
    try {
      const res = await fetch(`/api/dashboard/listing-offers/${offerId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "rejected" }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        offer?: { status: ListingOfferStatus };
        error?: string;
      };
      if (!res.ok || !body.ok) {
        setOfferActionError(body.error ?? "Failed to decline offer.");
        return;
      }
      setOffers((prev) =>
        prev.map((o) =>
          o.id === offerId ? { ...o, status: "rejected" as ListingOfferStatus } : o,
        ),
      );
    } catch (e) {
      setOfferActionError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setPendingOfferAction((cur) => (cur === `${offerId}:decline` ? null : cur));
    }
  }

  async function acceptOffer(offerId: string, offerPrice: number) {
    if (
      !confirm(
        `Accept this offer at ${formatMoney(offerPrice)}?\n\nThis marks the offer accepted, flips the listing to "under contract," and opens the new-transaction form prefilled with the listing + offer details.`,
      )
    ) {
      return;
    }
    setPendingOfferAction(`${offerId}:accept`);
    setOfferActionError(null);
    try {
      // 1. PATCH the listing-offer to accepted (stamps accepted_at).
      const acceptRes = await fetch(`/api/dashboard/listing-offers/${offerId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "accepted" }),
      });
      const acceptBody = (await acceptRes.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!acceptRes.ok || !acceptBody.ok) {
        setOfferActionError(acceptBody.error ?? "Failed to accept offer.");
        return;
      }
      // 2. Mark the listing under contract immediately. Doing this
      //    BEFORE the form opens means the listing reflects reality
      //    even if the agent abandons the form mid-create. The
      //    transaction row is created when the form is submitted
      //    (Phase 2d's lifecycle hand-off, but split across two
      //    user actions instead of being auto-fired).
      const listingPatchRes = await fetch(
        `/api/dashboard/listings/${encodeURIComponent(listing.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "contracted" }),
        },
      );
      const listingPatchBody = (await listingPatchRes.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!listingPatchRes.ok || !listingPatchBody.ok) {
        // Offer is accepted, listing flip failed. Surface the
        // error but optimistically reflect the offer state in UI.
        setOfferActionError(
          listingPatchBody.error ??
            "Offer accepted, but failed to mark the listing under contract.",
        );
        setOffers((prev) =>
          prev.map((o) =>
            o.id === offerId ? { ...o, status: "accepted" as ListingOfferStatus } : o,
          ),
        );
        return;
      }
      // 3. Route to the prefilled new-transaction form. The form
      //    knows how to fetch from listingId + listingOfferId and
      //    seed buyer/address/price/dates/contingencies for the
      //    agent to confirm before the transaction lands.
      router.push(
        `/dashboard/transactions/new?listingId=${encodeURIComponent(listing.id)}&listingOfferId=${encodeURIComponent(offerId)}`,
      );
    } catch (e) {
      setOfferActionError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setPendingOfferAction((cur) => (cur === `${offerId}:accept` ? null : cur));
    }
  }

  async function recordCounter(offerId: string) {
    setOfferActionError(null);
    const priceNum = counterPrice ? Number(counterPrice) : null;
    if (priceNum != null && (!Number.isFinite(priceNum) || priceNum <= 0)) {
      setOfferActionError("Counter price must be a positive number.");
      return;
    }
    setPendingOfferAction(`${offerId}:counter`);
    try {
      const res = await fetch(
        `/api/dashboard/listing-offers/${offerId}/counters`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            // Counter direction: seller_to_buyer is the listing
            // agent countering the buyer's offer (the typical case
            // here since this UI is the listing-side view).
            direction: "seller_to_buyer",
            price: priceNum,
            notes: counterNotes.trim() || null,
          }),
        },
      );
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !body.ok) {
        setOfferActionError(body.error ?? "Failed to record counter.");
        return;
      }
      // Optimistic: bump the counter_count + flip status to 'countered'.
      setOffers((prev) =>
        prev.map((o) =>
          o.id === offerId
            ? {
                ...o,
                status: "countered" as ListingOfferStatus,
                counter_count: o.counter_count + 1,
                current_price: priceNum ?? o.current_price,
              }
            : o,
        ),
      );
      setCounterFormForOfferId(null);
      setCounterPrice("");
      setCounterNotes("");
    } catch (e) {
      setOfferActionError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setPendingOfferAction((cur) => (cur === `${offerId}:counter` ? null : cur));
    }
  }

  // Promote button visible only on listings that haven't been
  // promoted yet AND aren't in a terminal state. The action moves
  // the listing into "contracted" and spawns a transaction so the
  // post-acceptance lifecycle (escrow, contingencies, closing)
  // gets its own row to track against.
  const canPromote =
    !listing.transactionId &&
    listing.status !== "contracted" &&
    listing.status !== "withdrawn" &&
    listing.status !== "expired";

  async function promote() {
    if (!confirm(
      `Mark this listing under contract?\n\nThis spawns a deal so escrow + closing can be tracked.`,
    )) {
      return;
    }
    setPromoting(true);
    setPromoteError(null);
    try {
      const res = await fetch(
        `/api/dashboard/listings/${encodeURIComponent(listing.id)}/promote`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        transactionId?: string;
        error?: string;
      };
      if (!res.ok || !body.ok || !body.transactionId) {
        setPromoteError(body.error ?? "Failed to promote listing.");
        return;
      }
      // Land on the new transaction so the agent can keep
      // working on the post-acceptance details immediately.
      router.push(`/dashboard/transactions/${body.transactionId}`);
    } catch (e) {
      setPromoteError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setPromoting(false);
    }
  }

  return (
    <main id="main-content" className="mx-auto max-w-5xl space-y-5 px-4 py-8">
      <div>
        <div className="text-xs text-slate-500">
          <Link href="/dashboard/properties" className="hover:underline">
            Listings
          </Link>
          {" / "}
          <span className="truncate">{listing.property_address}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {listing.property_address}
            </h1>
            {fullLocation ? (
              <p className="mt-0.5 text-sm text-slate-500">{fullLocation}</p>
            ) : null}
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${STATUS_BADGE[listing.status]}`}
          >
            {LISTING_STATUS_LABEL[listing.status]}
          </span>
        </div>

        {/* Lifecycle area — two states:
            (a) listing already promoted (has a back-linked
                transaction) → blue "Open contracted deal" bridge
                so the agent can jump to the post-acceptance view
            (b) listing not yet promoted but eligible → emerald
                "Mark under contract" CTA that fires the promote
                endpoint, spawning a transaction to track escrow */}
        {listing.transactionId ? (
          <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
            <Link
              href={`/dashboard/transactions/${listing.transactionId}`}
              className="font-medium hover:underline"
            >
              Open contracted deal →
            </Link>
            <span className="ml-2 text-[11px] text-blue-700">
              Closing date, contingencies, and escrow tasks live on the deal page.
            </span>
          </div>
        ) : canPromote ? (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-emerald-900">
                <span className="font-medium">Offer accepted?</span>
                <span className="ml-2 text-[11px] text-emerald-700">
                  Mark under contract — spawns a deal so closing + contingencies
                  get tracked separately.
                </span>
              </div>
              <button
                type="button"
                onClick={() => void promote()}
                disabled={promoting}
                className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {promoting ? "Promoting…" : "Mark under contract"}
              </button>
            </div>
            {promoteError ? (
              <p className="mt-2 text-[11px] text-rose-700">{promoteError}</p>
            ) : null}
          </div>
        ) : null}

        {/* Add-offer surface — sits below the promote area so the
            page reads top-to-bottom: status → mark-under-contract →
            track incoming offers. Toggleable inline form so the
            agent can record offers without leaving the listing
            page. PDF upload (extractContract pipeline) is a
            follow-up — for now manual entry only. */}
        <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm">
              <span className="font-medium text-slate-800">Offers received</span>
              {offers.length > 0 ? (
                <span className="ml-2 text-[11px] text-emerald-700">
                  {offers.length} {offers.length === 1 ? "offer" : "offers"} on file
                </span>
              ) : (
                <span className="ml-2 text-[11px] text-slate-500">
                  Track offers as they come in.
                </span>
              )}
            </div>
            <Link
              href={`/dashboard/listings/${encodeURIComponent(listing.id)}/offers/new`}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              + Add offer
            </Link>
          </div>
        </div>
      </div>

      {/* ── Key facts ────────────────────────────────────────────── */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card title="Property">
          <DetailRow label="Address" value={listing.property_address} />
          <DetailRow label="City / State" value={cityState || "—"} />
          <DetailRow label="ZIP" value={listing.zip ?? "—"} />
          <DetailRow label="MLS #" value={listing.mls_number ?? "—"} />
          {listing.mls_url ? (
            <DetailRow
              label="Listing URL"
              value={
                <a
                  href={listing.mls_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Open ↗
                </a>
              }
            />
          ) : null}
        </Card>

        <Card title="Pricing">
          <DetailRow label="List price" value={formatMoney(listing.list_price)} />
          <DetailRow
            label="Commission"
            value={listing.commission_pct != null ? `${listing.commission_pct}%` : "—"}
          />
        </Card>

        <Card title="Dates">
          <DetailRow label="Listed" value={formatDate(listing.listing_start_date)} />
          <DetailRow label="Expires" value={formatDate(listing.listing_end_date)} />
          <DetailRow label="Created" value={formatRelative(listing.created_at)} />
        </Card>

        <Card title="Seller">
          <DetailRow label="Name" value={listing.contactName ?? "—"} />
        </Card>

        <Card title="Showings">
          <DetailRow label="Total" value={String(listing.showings_total)} />
          <DetailRow label="Upcoming" value={String(listing.showings_upcoming)} />
          <DetailRow label="Last" value={formatRelative(listing.last_showing_at)} />
          <div className="pt-1">
            <Link
              href={`/dashboard/showings?propertyAddress=${encodeURIComponent(listing.property_address)}`}
              className="text-xs text-blue-600 hover:underline"
            >
              View all showings →
            </Link>
          </div>
        </Card>

        {listing.notes ? (
          <Card title="Notes">
            <p className="whitespace-pre-wrap text-sm text-slate-700">
              {listing.notes}
            </p>
          </Card>
        ) : null}
      </section>

      {/* Offers received — list with per-row actions. Sits below
          the cards grid because it's the operational surface (the
          cards above are "what's true about this listing"; this is
          "what do I need to act on"). Only renders when there are
          offers in flight; the empty state lives up in the
          Offers received header above to keep this section tight. */}
      {offers.length > 0 ? (
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-baseline gap-3">
              <h2 className="text-sm font-semibold text-slate-900">
                Offers ({offers.length})
              </h2>
              {offerActionError ? (
                <span className="text-[11px] text-rose-700">{offerActionError}</span>
              ) : null}
            </div>
            {/* Sort selector — only useful when there's more than
                one offer. Single-offer listings just show the
                default order without the chrome. */}
            {offers.length > 1 ? (
              <label className="inline-flex items-center gap-2 text-[11px] text-slate-500">
                Sort:
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as OfferSort)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
                >
                  {OFFER_SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          <ol className="space-y-2">
            {sortedOffers(offers, sortBy).map((o) => {
              const isClosed =
                o.status === "accepted" ||
                o.status === "rejected" ||
                o.status === "withdrawn" ||
                o.status === "expired";
              const isAccepting = pendingOfferAction === `${o.id}:accept`;
              const isDeclining = pendingOfferAction === `${o.id}:decline`;
              const isCountering = pendingOfferAction === `${o.id}:counter`;
              const showCounterForm = counterFormForOfferId === o.id;
              return (
                <li
                  key={o.id}
                  className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-900">
                          {o.buyer_name ?? "Unnamed buyer"}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${OFFER_STATUS_BADGE[o.status]}`}
                        >
                          {OFFER_STATUS_LABEL[o.status]}
                        </span>
                        {o.is_cash ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                            Cash
                          </span>
                        ) : null}
                        {o.counter_count > 0 ? (
                          <span className="text-[11px] text-slate-500">
                            {o.counter_count} counter{o.counter_count === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-600">
                        <span>
                          <span className="text-slate-400">Offer:</span>{" "}
                          <span className="tabular-nums">{formatMoney(o.offer_price)}</span>
                        </span>
                        {o.current_price != null && o.current_price !== o.offer_price ? (
                          <span>
                            <span className="text-slate-400">Current:</span>{" "}
                            <span className="tabular-nums font-medium text-slate-900">
                              {formatMoney(o.current_price)}
                            </span>
                          </span>
                        ) : null}
                        {o.earnest_money != null ? (
                          <span>
                            <span className="text-slate-400">EMD:</span>{" "}
                            <span className="tabular-nums">{formatMoney(o.earnest_money)}</span>
                          </span>
                        ) : null}
                        {o.contingency_count > 0 ? (
                          <span>
                            <span className="text-slate-400">Contingencies:</span>{" "}
                            {o.contingency_count}
                          </span>
                        ) : (
                          <span className="text-emerald-700">No contingencies</span>
                        )}
                      </div>
                      {o.notes ? (
                        <div className="mt-1 truncate text-[12px] text-slate-500">
                          {o.notes}
                        </div>
                      ) : null}
                    </div>
                    {!isClosed ? (
                      <div className="flex shrink-0 flex-wrap items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void acceptOffer(o.id, o.offer_price)}
                          disabled={isAccepting || isDeclining || isCountering}
                          className="rounded-lg bg-emerald-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
                          title="Mark this offer accepted + spawn a deal"
                        >
                          {isAccepting ? "Accepting…" : "✓ Accept"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCounterFormForOfferId(showCounterForm ? null : o.id);
                            setCounterPrice(
                              o.current_price != null ? String(o.current_price) : "",
                            );
                            setCounterNotes("");
                            setOfferActionError(null);
                          }}
                          disabled={isAccepting || isDeclining}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          title="Record a counter to the buyer"
                        >
                          {showCounterForm ? "Cancel" : "🔁 Counter"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void declineOffer(o.id)}
                          disabled={isAccepting || isDeclining || isCountering}
                          className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                          title="Mark this offer rejected"
                        >
                          {isDeclining ? "Declining…" : "✗ Decline"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                  {showCounterForm ? (
                    <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-700">
                            Counter price
                          </label>
                          <input
                            type="number"
                            value={counterPrice}
                            onChange={(e) => setCounterPrice(e.target.value)}
                            placeholder={String(o.current_price ?? o.offer_price)}
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700">
                            Notes
                          </label>
                          <input
                            value={counterNotes}
                            onChange={(e) => setCounterNotes(e.target.value)}
                            placeholder="Closing moved, terms changed…"
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setCounterFormForOfferId(null)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void recordCounter(o.id)}
                          disabled={isCountering}
                          className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                        >
                          {isCountering ? "Recording…" : "Record counter"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}
    </main>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <dt className="shrink-0 text-xs font-medium text-slate-500">{label}</dt>
      <dd className="min-w-0 truncate text-right text-slate-900">{value}</dd>
    </div>
  );
}
