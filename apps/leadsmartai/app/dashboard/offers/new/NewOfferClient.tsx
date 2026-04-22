"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import ContactPicker, { type ContactPickerValue } from "@/components/crm/ContactPicker";
import type { FinancingType } from "@/lib/offers/types";

/**
 * Create a new offer. Accepts:
 *   ?contactId=<uuid>   — deep-link prefill for the buyer
 *   ?showingId=<uuid>   — back-link to the showing that sourced it
 *                         (we store the FK; we don't fetch the showing
 *                         to prefill address because the agent may be
 *                         offering on a different property than the one
 *                         they showed.)
 *
 * Default: creates as `draft`. The "Submit now" checkbox flips to
 * `submitted` + stamps submitted_at in the same request.
 */

function NewOfferForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledContactId = searchParams.get("contactId") ?? "";
  const prefilledShowingId = searchParams.get("showingId") ?? "";

  const [contact, setContact] = useState<ContactPickerValue | null>(null);
  const [propertyAddress, setPropertyAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setStateValue] = useState("CA");
  const [zip, setZip] = useState("");
  const [listPrice, setListPrice] = useState("");
  const [offerPrice, setOfferPrice] = useState("");
  const [earnestMoney, setEarnestMoney] = useState("");
  const [downPayment, setDownPayment] = useState("");
  const [financingType, setFinancingType] = useState<FinancingType | "">("");
  const [closingDateProposed, setClosingDateProposed] = useState("");
  const [offerExpiresAt, setOfferExpiresAt] = useState("");
  const [inspectionContingency, setInspectionContingency] = useState(true);
  const [appraisalContingency, setAppraisalContingency] = useState(true);
  const [loanContingency, setLoanContingency] = useState(true);
  const [contingencyNotes, setContingencyNotes] = useState("");
  const [notes, setNotes] = useState("");
  const [submitNow, setSubmitNow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!contact?.id || !propertyAddress.trim() || !offerPrice.trim()) {
      setError("Buyer, property address, and offer price are required.");
      return;
    }
    const priceNum = Number(offerPrice);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setError("Offer price must be a positive number.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/dashboard/offers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contactId: contact.id,
          showingId: prefilledShowingId || null,
          propertyAddress: propertyAddress.trim(),
          city: city.trim() || null,
          state: state.trim() || null,
          zip: zip.trim() || null,
          listPrice: listPrice ? Number(listPrice) : null,
          offerPrice: priceNum,
          earnestMoney: earnestMoney ? Number(earnestMoney) : null,
          downPayment: downPayment ? Number(downPayment) : null,
          financingType: financingType || null,
          closingDateProposed: closingDateProposed || null,
          offerExpiresAt: offerExpiresAt ? new Date(offerExpiresAt).toISOString() : null,
          inspectionContingency,
          appraisalContingency,
          loanContingency,
          contingencyNotes: contingencyNotes.trim() || null,
          notes: notes.trim() || null,
          submitNow,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        offer?: { id: string };
        error?: string;
      };
      if (!res.ok || !body.ok || !body.offer) {
        setError(body.error ?? "Failed to create offer.");
        return;
      }
      router.push(`/dashboard/offers/${body.offer.id}`);
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
          <Link href="/dashboard/offers" className="hover:underline">
            Offers
          </Link>
          {" / New"}
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">New offer</h1>
        <p className="mt-1 text-sm text-slate-500">
          Log an offer you&apos;re about to submit or have already submitted. Track counters
          and convert to a transaction if it&apos;s accepted.
        </p>
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <label className="block text-xs font-medium text-slate-700">Buyer *</label>
          <ContactPicker
            value={contact}
            onChange={setContact}
            initialContactId={prefilledContactId || null}
            helperText="Start typing the buyer's name, email, or phone."
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

        <div className="grid grid-cols-4 gap-3">
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
          <div>
            <label className="block text-xs font-medium text-slate-700">ZIP</label>
            <input
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              maxLength={10}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700">List price</label>
            <input
              type="number"
              value={listPrice}
              onChange={(e) => setListPrice(e.target.value)}
              placeholder="1200000"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Offer price *</label>
            <input
              type="number"
              value={offerPrice}
              onChange={(e) => setOfferPrice(e.target.value)}
              placeholder="1150000"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700">Earnest money</label>
            <input
              type="number"
              value={earnestMoney}
              onChange={(e) => setEarnestMoney(e.target.value)}
              placeholder="30000"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Down payment</label>
            <input
              type="number"
              value={downPayment}
              onChange={(e) => setDownPayment(e.target.value)}
              placeholder="230000"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Financing</label>
            <select
              value={financingType}
              onChange={(e) => setFinancingType(e.target.value as FinancingType | "")}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">—</option>
              <option value="cash">Cash</option>
              <option value="conventional">Conventional</option>
              <option value="fha">FHA</option>
              <option value="va">VA</option>
              <option value="jumbo">Jumbo</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700">Proposed closing</label>
            <input
              type="date"
              value={closingDateProposed}
              onChange={(e) => setClosingDateProposed(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Offer expires</label>
            <input
              type="datetime-local"
              value={offerExpiresAt}
              onChange={(e) => setOfferExpiresAt(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="space-y-2 rounded-lg bg-slate-50 p-3">
          <div className="text-xs font-medium text-slate-700">Contingencies</div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={inspectionContingency}
                onChange={(e) => setInspectionContingency(e.target.checked)}
                className="h-4 w-4"
              />
              Inspection
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={appraisalContingency}
                onChange={(e) => setAppraisalContingency(e.target.checked)}
                className="h-4 w-4"
              />
              Appraisal
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={loanContingency}
                onChange={(e) => setLoanContingency(e.target.checked)}
                className="h-4 w-4"
              />
              Loan
            </label>
          </div>
          <input
            value={contingencyNotes}
            onChange={(e) => setContingencyNotes(e.target.value)}
            placeholder="Other contingencies (sale-of-home, short-sale approval, etc.)"
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
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

        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={submitNow}
            onChange={(e) => setSubmitNow(e.target.checked)}
            className="h-4 w-4"
          />
          <span>Mark as submitted (stamps submitted_at = now)</span>
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Link
            href="/dashboard/offers"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting || !contact?.id || !propertyAddress.trim() || !offerPrice.trim()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? "Creating…" : submitNow ? "Create + submit" : "Create draft"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function NewOfferClient() {
  return (
    <Suspense fallback={<div className="text-sm text-slate-500">Loading…</div>}>
      <NewOfferForm />
    </Suspense>
  );
}
