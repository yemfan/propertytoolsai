"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import ContactPicker, { type ContactPickerValue } from "@/components/crm/ContactPicker";
import { ContractUploader, type RlaUploadResult, type RpaUploadResult } from "./ContractUploader";

/**
 * New-transaction form. Buyer-side or listing-side, both supported.
 *
 * On listing-rep deals, `listing_start_date` is the anchor for pre-list +
 * marketing tasks; `mutual_acceptance_date` becomes the anchor for
 * post-offer tasks once the seller accepts.
 *
 * Accepts `?contactId=<uuid>` as a deep-link prefill — ContactPicker
 * resolves the display name once on mount.
 */
type TxType = "buyer_rep" | "listing_rep" | "dual";

function NewTransactionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledContactId = searchParams.get("contactId") ?? "";
  /** ?offerId=<uuid> — agent clicked ✓ Accept on /dashboard/offers and
   *  was routed here. We fetch the offer and prefill buyer + address +
   *  price + dates so the agent only needs to confirm + upload the
   *  signed RPA via the ContractUploader. The id is also POSTed back
   *  with the create request so the API can set offer.transaction_id. */
  const prefilledOfferId = searchParams.get("offerId") ?? "";

  // Honor `?type=listing_rep` (or `dual`) so the Listings page button
  // — and CommandPalette deep links — open the form already on the
  // listing-side track. Default stays buyer_rep when no type passed.
  const typeParam = searchParams.get("type");
  const initialType: TxType =
    typeParam === "listing_rep" || typeParam === "dual"
      ? typeParam
      : "buyer_rep";
  const focusUpload = searchParams.get("focus") === "upload";

  const [transactionType, setTransactionType] = useState<TxType>(initialType);
  const [contact, setContact] = useState<ContactPickerValue | null>(null);
  const [contactInitialId, setContactInitialId] = useState<string | null>(
    prefilledContactId || null,
  );
  const [propertyAddress, setPropertyAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setStateValue] = useState("CA");
  const [zip, setZip] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [listingStartDate, setListingStartDate] = useState("");
  const [mutualAcceptanceDate, setMutualAcceptanceDate] = useState("");
  const [closingDate, setClosingDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Banner shown when this form was opened from an accepted offer.
   *  Surfaces the source address so the agent knows where the
   *  prefilled data came from. */
  const [offerBanner, setOfferBanner] = useState<string | null>(null);

  const isListing = transactionType === "listing_rep";

  /**
   * Prefill from an accepted offer when the form was opened via
   * /dashboard/transactions/new?offerId=<id>. Maps:
   *   offer.contact_id   → buyer (ContactPicker.value)
   *   offer.property_*   → address fields
   *   offer.current_price ?? offer.offer_price → purchase price
   *   offer.accepted_at slice → mutual acceptance date
   *   offer.closing_date_proposed → closing date
   *   offer.notes        → notes
   *
   * Forces transaction_type to buyer_rep — this flow only triggers
   * when an agent accepts an offer they wrote on a buyer's behalf.
   * Skips silently if the fetch fails so the empty form still works.
   */
  useEffect(() => {
    if (!prefilledOfferId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/dashboard/offers/${encodeURIComponent(prefilledOfferId)}`,
          { cache: "no-store" },
        );
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          offer?: {
            contact_id: string;
            property_address: string;
            city: string | null;
            state: string | null;
            zip: string | null;
            offer_price: number;
            current_price: number | null;
            accepted_at: string | null;
            closing_date_proposed: string | null;
            notes: string | null;
          };
          contactName?: string | null;
        };
        if (cancelled || !res.ok || !body.ok || !body.offer) return;
        const o = body.offer;

        setTransactionType("buyer_rep");
        setContact({
          id: o.contact_id,
          name: body.contactName ?? "Buyer",
        });
        setContactInitialId(o.contact_id);
        if (o.property_address) setPropertyAddress(o.property_address);
        if (o.city) setCity(o.city);
        if (o.state) setStateValue(o.state);
        if (o.zip) setZip(o.zip);
        const price = o.current_price ?? o.offer_price;
        if (price != null) setPurchasePrice(String(Math.round(price)));
        if (o.accepted_at) setMutualAcceptanceDate(o.accepted_at.slice(0, 10));
        if (o.closing_date_proposed) setClosingDate(o.closing_date_proposed);
        if (o.notes) setNotes(o.notes);
        setOfferBanner(`Creating transaction from accepted offer — ${o.property_address}`);
      } catch {
        // Empty form is a fine fallback.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [prefilledOfferId]);

  /**
   * When the agent arrives via the Listings page "Upload listing
   * agreement" button (`?focus=upload`), scroll the contract uploader
   * into view and briefly ring it so it's obviously the next action.
   * Skipped if focus param is absent — keeps the default open-the-form
   * UX intact for everyone else.
   */
  const uploaderRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!focusUpload) return;
    const el = uploaderRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-blue-400", "ring-offset-2", "rounded-2xl");
    const timer = window.setTimeout(() => {
      el.classList.remove("ring-2", "ring-blue-400", "ring-offset-2", "rounded-2xl");
    }, 2400);
    return () => window.clearTimeout(timer);
  }, [focusUpload]);

  async function submit() {
    setError(null);
    if (!contact?.id || !propertyAddress.trim()) {
      setError("Contact and property address are required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/dashboard/transactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contactId: contact.id,
          transactionType,
          propertyAddress: propertyAddress.trim(),
          city: city.trim() || null,
          state: state.trim() || null,
          zip: zip.trim() || null,
          purchasePrice: purchasePrice ? Number(purchasePrice) : null,
          listingStartDate: listingStartDate || null,
          mutualAcceptanceDate: mutualAcceptanceDate || null,
          closingDate: closingDate || null,
          notes: notes.trim() || null,
          // When this form was opened via ?offerId, send it back so
          // the API can set offer.transaction_id for the back-link.
          offerId: prefilledOfferId || null,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        transaction?: { id: string };
        error?: string;
      };
      if (!res.ok || !body.ok || !body.transaction) {
        setError(body.error ?? "Failed to create transaction.");
        return;
      }
      router.push(`/dashboard/transactions/${body.transaction.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  function applyRpaExtraction(ext: RpaUploadResult) {
    // Buyer/seller name from the extraction is informational only — the
    // agent still has to pick the existing contact in their CRM. We don't
    // auto-match by name; too much risk of picking the wrong John Smith.
    if (ext.propertyAddress) setPropertyAddress(ext.propertyAddress);
    if (ext.city) setCity(ext.city);
    if (ext.state) setStateValue(ext.state);
    if (ext.zip) setZip(ext.zip);
    if (ext.purchasePrice != null) setPurchasePrice(String(ext.purchasePrice));
    if (ext.mutualAcceptanceDate) setMutualAcceptanceDate(ext.mutualAcceptanceDate);
    if (ext.closingDate) setClosingDate(ext.closingDate);
  }

  function applyRlaExtraction(ext: RlaUploadResult) {
    if (ext.propertyAddress) setPropertyAddress(ext.propertyAddress);
    if (ext.city) setCity(ext.city);
    if (ext.state) setStateValue(ext.state);
    if (ext.zip) setZip(ext.zip);
    if (ext.listPrice != null) setPurchasePrice(String(ext.listPrice));
    if (ext.listingStartDate) setListingStartDate(ext.listingStartDate);
  }

  // When the agent arrives via /dashboard/properties' "+ New listing"
  // button, the URL carries ?type=listing_rep. The data model is the
  // same (listings live in the transactions table) but the page
  // identity should match the entry point — saying "Transactions /
  // New transaction" after clicking "+ New listing" is needlessly
  // jarring. Adapt the breadcrumb + heading + back link so the page
  // reads as listing-rep when that's the entry path.
  const breadcrumbHref = isListing ? "/dashboard/properties" : "/dashboard/transactions";
  const breadcrumbLabel = isListing ? "Listings" : "Transactions";
  const headingText = isListing ? "New listing" : "New transaction";

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <div className="text-xs text-slate-500">
          <Link href={breadcrumbHref} className="hover:underline">
            {breadcrumbLabel}
          </Link>
          {" / New"}
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">{headingText}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Seeds a {isListing ? "listing-rep" : "buyer-rep"} checklist and auto-fills deadlines
          from the anchor date. You can adjust anything later.
        </p>
        {offerBanner ? (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <div className="font-medium">{offerBanner}</div>
            <div className="mt-0.5 text-[11px] text-emerald-700">
              Buyer, address, price, and dates are prefilled. Upload the signed RPA below to
              extract contingencies + closing details automatically.
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div ref={uploaderRef}>
          {isListing ? (
            <ContractUploader
              kind="listing"
              onExtracted={applyRlaExtraction}
              disabled={submitting}
            />
          ) : (
            <ContractUploader onExtracted={applyRpaExtraction} disabled={submitting} />
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700">Deal type</label>
          <div className="mt-1 flex gap-2">
            {(["buyer_rep", "listing_rep", "dual"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTransactionType(t)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                  transactionType === t
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {t === "buyer_rep" ? "Buyer side" : t === "listing_rep" ? "Listing side" : "Dual agent"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700">
            {isListing ? "Seller *" : "Buyer *"}
          </label>
          <ContactPicker
            // Re-key when contactInitialId changes so the picker
            // re-runs its name-resolve effect — important for the
            // ?offerId path where we discover the contact id after
            // the initial mount.
            key={contactInitialId ?? "anonymous"}
            value={contact}
            onChange={setContact}
            initialContactId={contactInitialId}
            helperText={
              isListing
                ? "Start typing the seller's name, email, or phone."
                : "Start typing the buyer's name, email, or phone. Recent contacts show if left blank."
            }
            className="mt-1"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700">Property address *</label>
          <input
            value={propertyAddress}
            onChange={(e) => setPropertyAddress(e.target.value)}
            placeholder="123 Main St"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-700">City</label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">State</label>
            <input
              value={state}
              onChange={(e) => setStateValue(e.target.value.toUpperCase())}
              maxLength={2}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700">ZIP</label>
            <input
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              maxLength={10}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              {isListing ? "List price" : "Purchase price"}
            </label>
            <input
              type="number"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              placeholder="1000000"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {isListing && (
          <div>
            <label className="block text-xs font-medium text-slate-700">Listing start date</label>
            <input
              type="date"
              value={listingStartDate}
              onChange={(e) => setListingStartDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              RLA signed / MLS go-live. Anchors pre-list + marketing deadlines.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Mutual acceptance
            </label>
            <input
              type="date"
              value={mutualAcceptanceDate}
              onChange={(e) => setMutualAcceptanceDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              {isListing
                ? "Set when you accept an offer. Anchors closing deadlines."
                : "Anchors all contingency deadlines."}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Closing date</label>
            <input
              type="date"
              value={closingDate}
              onChange={(e) => setClosingDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Auto-fills to mutual acceptance + 30 days if left blank.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Link
            href={breadcrumbHref}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting || !contact?.id || !propertyAddress.trim()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? "Creating…" : isListing ? "Create listing" : "Create transaction"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function NewTransactionClient() {
  return (
    <Suspense fallback={<div className="text-sm text-slate-500">Loading…</div>}>
      <NewTransactionForm />
    </Suspense>
  );
}
