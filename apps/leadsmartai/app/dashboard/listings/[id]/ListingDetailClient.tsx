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

  // Add-offer inline form state. Compact field set: buyer + price
  // + key terms. Status flips on the listing happen via the
  // promote flow (Mark under contract) so the offer form here
  // intentionally doesn't ask for status — every offer lands as
  // 'submitted' and the agent transitions it later.
  const [addingOffer, setAddingOffer] = useState(false);
  const [savingOffer, setSavingOffer] = useState(false);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [offerForm, setOfferForm] = useState({
    buyerName: "",
    offerPrice: "",
    earnestMoney: "",
    downPayment: "",
    notes: "",
  });

  // Offers list — per-row action state. The list can update
  // optimistically without a full router.refresh() so the agent
  // doesn't see a flicker when accepting / declining / countering.
  // Each action keys its in-flight pending state by `${offerId}:${kind}`
  // so two rows can be acted on independently.
  const [offers, setOffers] = useState<ListingOfferCompareItem[]>(initialOffers);
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
        `Accept this offer at ${formatMoney(offerPrice)}?\n\nThis marks the offer accepted, flips the listing to "contracted," and spawns a deal so escrow can be tracked.`,
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
      // 2. Promote the listing — Phase 2d's lifecycle hand-off.
      //    Pass the offer's price so the spawned transaction
      //    captures the agreed price (vs original list).
      const promoteRes = await fetch(
        `/api/dashboard/listings/${encodeURIComponent(listing.id)}/promote`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ purchasePrice: offerPrice }),
        },
      );
      const promoteBody = (await promoteRes.json().catch(() => ({}))) as {
        ok?: boolean;
        transactionId?: string;
        error?: string;
      };
      if (!promoteRes.ok || !promoteBody.ok || !promoteBody.transactionId) {
        // Best-effort fallback: the offer is accepted, but the
        // promote failed. Surface the error and stay on the page;
        // the agent can retry via the "Mark under contract" CTA.
        setOfferActionError(
          promoteBody.error ??
            "Offer accepted, but failed to spawn the deal. Use 'Mark under contract' to retry.",
        );
        setOffers((prev) =>
          prev.map((o) =>
            o.id === offerId ? { ...o, status: "accepted" as ListingOfferStatus } : o,
          ),
        );
        return;
      }
      router.push(`/dashboard/transactions/${promoteBody.transactionId}`);
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

  async function submitOffer() {
    setOfferError(null);
    const priceNum = Number(offerForm.offerPrice);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setOfferError("Offer price is required and must be a positive number.");
      return;
    }
    setSavingOffer(true);
    try {
      const res = await fetch(
        `/api/dashboard/listings/${encodeURIComponent(listing.id)}/offers`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            offerPrice: priceNum,
            buyerName: offerForm.buyerName.trim() || null,
            earnestMoney: offerForm.earnestMoney
              ? Number(offerForm.earnestMoney)
              : null,
            downPayment: offerForm.downPayment
              ? Number(offerForm.downPayment)
              : null,
            notes: offerForm.notes.trim() || null,
          }),
        },
      );
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        offer?: { id: string };
        error?: string;
      };
      if (!res.ok || !body.ok || !body.offer) {
        setOfferError(body.error ?? "Failed to record offer.");
        return;
      }
      // Insert the new offer at the top of the local list so the
      // agent sees it immediately without router.refresh().
      // Compute derived fields the same way listOffersForListing
      // does (counter_count starts at 0; contingencies all default
      // true on insert; is_cash from financing_type).
      const created = body.offer as ListingOfferCompareItem;
      setOffers((prev) => [
        {
          ...created,
          counter_count: 0,
          contingency_count:
            (created.inspection_contingency ? 1 : 0) +
            (created.appraisal_contingency ? 1 : 0) +
            (created.loan_contingency ? 1 : 0) +
            (created.sale_of_home_contingency ? 1 : 0),
          is_cash: created.financing_type === "cash",
        },
        ...prev,
      ]);
      setOfferForm({
        buyerName: "",
        offerPrice: "",
        earnestMoney: "",
        downPayment: "",
        notes: "",
      });
      setAddingOffer(false);
    } catch (e) {
      setOfferError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setSavingOffer(false);
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
            <button
              type="button"
              onClick={() => {
                setOfferError(null);
                setAddingOffer((v) => !v);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {addingOffer ? "Cancel" : "+ Add offer"}
            </button>
          </div>
          {addingOffer ? (
            <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Buyer name
                  </label>
                  <input
                    value={offerForm.buyerName}
                    onChange={(e) =>
                      setOfferForm((f) => ({ ...f, buyerName: e.target.value }))
                    }
                    placeholder="John & Jane Smith"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Offer price *
                  </label>
                  <input
                    type="number"
                    value={offerForm.offerPrice}
                    onChange={(e) =>
                      setOfferForm((f) => ({ ...f, offerPrice: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Earnest money
                  </label>
                  <input
                    type="number"
                    value={offerForm.earnestMoney}
                    onChange={(e) =>
                      setOfferForm((f) => ({ ...f, earnestMoney: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Down payment
                  </label>
                  <input
                    type="number"
                    value={offerForm.downPayment}
                    onChange={(e) =>
                      setOfferForm((f) => ({ ...f, downPayment: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Notes</label>
                <input
                  value={offerForm.notes}
                  onChange={(e) =>
                    setOfferForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  placeholder="30-day close, no inspection, etc."
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </div>
              {offerError ? (
                <p className="text-xs text-rose-700">{offerError}</p>
              ) : null}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setAddingOffer(false)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void submitOffer()}
                  disabled={savingOffer || !offerForm.offerPrice}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {savingOffer ? "Saving…" : "Record offer"}
                </button>
              </div>
            </div>
          ) : null}
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
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Offers ({offers.length})
            </h2>
            {offerActionError ? (
              <span className="text-[11px] text-rose-700">{offerActionError}</span>
            ) : null}
          </div>
          <ol className="space-y-2">
            {offers.map((o) => {
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
