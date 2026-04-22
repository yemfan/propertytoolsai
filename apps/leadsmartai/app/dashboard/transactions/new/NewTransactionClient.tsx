"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import ContactPicker, { type ContactPickerValue } from "@/components/crm/ContactPicker";

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
type TxType = "buyer_rep" | "listing_rep";

function NewTransactionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledContactId = searchParams.get("contactId") ?? "";

  const [transactionType, setTransactionType] = useState<TxType>("buyer_rep");
  const [contact, setContact] = useState<ContactPickerValue | null>(null);
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

  const isListing = transactionType === "listing_rep";

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

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <div className="text-xs text-slate-500">
          <Link href="/dashboard/transactions" className="hover:underline">
            Transactions
          </Link>
          {" / New"}
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">New transaction</h1>
        <p className="mt-1 text-sm text-slate-500">
          Seeds a California {isListing ? "listing-rep" : "buyer-rep"} checklist and auto-fills
          deadlines from the anchor date. You can adjust anything later.
        </p>
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <label className="block text-xs font-medium text-slate-700">Deal type</label>
          <div className="mt-1 flex gap-2">
            {(["buyer_rep", "listing_rep"] as const).map((t) => (
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
                {t === "buyer_rep" ? "Buyer side" : "Listing side"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700">
            {isListing ? "Seller *" : "Buyer *"}
          </label>
          <ContactPicker
            value={contact}
            onChange={setContact}
            initialContactId={prefilledContactId || null}
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
            href="/dashboard/transactions"
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
            {submitting ? "Creating…" : "Create transaction"}
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
