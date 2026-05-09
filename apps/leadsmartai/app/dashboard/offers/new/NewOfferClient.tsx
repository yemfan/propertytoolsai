"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import AddressAutocomplete, {
  type AddressAutocompleteValue,
} from "@/components/AddressAutocomplete";
import ContactPicker, { type ContactPickerValue } from "@/components/crm/ContactPicker";
import type { FinancingType } from "@/lib/offers/types";

/**
 * Create a new offer. Accepts:
 *   ?contactId=<uuid>   — deep-link prefill for the buyer
 *   ?showingId=<uuid>   — back-link AND prefill source. We fetch the
 *                         showing on mount and seed property_address /
 *                         city / state / zip from it. Best-effort: also
 *                         pulls list_price from the property warehouse
 *                         when one is cached. Agent can still edit
 *                         everything before submitting (e.g. if the
 *                         buyer is offering on a different unit or the
 *                         list price has changed).
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
  // Percentage chips ("3%", "20%") let agents pick standard
  // earnest/down ratios and have the dollar amounts auto-fill from
  // the current offer price. null = "custom" (agent typed a manual
  // dollar value, so we leave it alone). Defaults: 3% earnest is
  // the typical CA EMD baseline; 20% down maps to a conventional
  // 80% LTV loan, which covers most cases the agent ships.
  const [earnestPct, setEarnestPct] = useState<number | null>(0.03);
  const [downPct, setDownPct] = useState<number | null>(0.2);
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
  /** Surfaces "Loaded from showing" / "Loading…" hint under the address field
   *  when we're prefilling from ?showingId. */
  const [prefillNote, setPrefillNote] = useState<string | null>(null);

  // Prefill property fields from the linked showing when ?showingId
  // is present. Two-tier:
  //
  //   1. Showing API → address / city / state / zip (always works,
  //      one DB row).
  //   2. Property warehouse → list_price (best-effort; cached for
  //      anything we've shown before, and we silently skip price
  //      prefill if the lookup fails or returns null).
  //
  // Runs once per mount. Won't clobber user edits because it bails
  // when propertyAddress is already populated.
  useEffect(() => {
    if (!prefilledShowingId) return;
    let cancelled = false;
    setPrefillNote("Loading from showing…");

    (async () => {
      try {
        const res = await fetch(
          `/api/dashboard/showings/${encodeURIComponent(prefilledShowingId)}`,
          { cache: "no-store" },
        );
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          showing?: {
            property_address?: string | null;
            city?: string | null;
            state?: string | null;
            zip?: string | null;
          };
        };
        if (cancelled) return;
        const sh = body?.showing;
        if (!res.ok || !body.ok || !sh?.property_address) {
          setPrefillNote(null);
          return;
        }

        // Address fields — only seed if the user hasn't already
        // typed something.
        setPropertyAddress((cur) => cur || sh.property_address || "");
        if (sh.city) setCity((cur) => cur || sh.city || "");
        if (sh.state) setStateValue((cur) => cur || sh.state || "");
        if (sh.zip) setZip((cur) => cur || sh.zip || "");
        setPrefillNote(`Prefilled from showing — ${sh.property_address}`);

        // Tier-2: list price from the warehouse. Non-blocking;
        // failures are silent so the agent can still type.
        try {
          const propRes = await fetch(
            `/api/property/${encodeURIComponent(sh.property_address)}`,
            { cache: "no-store" },
          );
          if (!propRes.ok || cancelled) return;
          const propBody = (await propRes.json().catch(() => ({}))) as {
            latest_snapshot?: { estimated_value?: number | null } | null;
            property?: { last_list_price?: number | null } | null;
          };
          const cachedPrice =
            propBody?.property?.last_list_price ??
            propBody?.latest_snapshot?.estimated_value ??
            null;
          if (cachedPrice && !cancelled) {
            setListPrice((cur) => cur || String(Math.round(cachedPrice)));
          }
        } catch {
          // Swallow — list price is a nice-to-have, not required.
        }
      } catch {
        if (!cancelled) setPrefillNote(null);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefilledShowingId]);

  // Auto-compute earnest money / down payment from offer price ×
  // selected percentage. Bails when offerPrice isn't numeric (so
  // typing a partial number doesn't churn) or when the chip is
  // null (= "custom", agent typed a manual dollar value).
  //
  // No setEarnestMoney → setEarnestPct loop here because the chip
  // setter is the only thing that can change earnestPct, and the
  // dollar input's onChange clears earnestPct to null.
  useEffect(() => {
    const n = Number(offerPrice);
    if (!Number.isFinite(n) || n <= 0) return;
    if (earnestPct != null) setEarnestMoney(String(Math.round(n * earnestPct)));
  }, [offerPrice, earnestPct]);

  useEffect(() => {
    const n = Number(offerPrice);
    if (!Number.isFinite(n) || n <= 0) return;
    if (downPct != null) setDownPayment(String(Math.round(n * downPct)));
  }, [offerPrice, downPct]);

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

          {/* Recent-addresses quick-pick was removed once the
              ?showingId prefill landed — that path covers the
              common case (offering on the property just shown)
              and the Recent list became redundant noise on top
              of an already-filled form. AddressAutocomplete below
              still handles the "different property" edge case. */}

          <AddressAutocomplete
            value={propertyAddress}
            onChange={setPropertyAddress}
            onSelect={(val: AddressAutocompleteValue) => {
              setPropertyAddress(val.formattedAddress);
              if (val.components.city) setCity(val.components.city);
              if (val.components.state) setStateValue(val.components.state);
              if (val.components.zip) setZip(val.components.zip);
            }}
            placeholder="Start typing — Google will autocomplete the full address"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          {(city || state || zip) ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
              {city ? <span className="rounded-full bg-slate-100 px-2 py-0.5">{city}</span> : null}
              {state ? <span className="rounded-full bg-slate-100 px-2 py-0.5">{state}</span> : null}
              {zip ? <span className="rounded-full bg-slate-100 px-2 py-0.5">{zip}</span> : null}
            </div>
          ) : null}
          {prefillNote ? (
            <div className="mt-1.5 text-[11px] text-emerald-700">{prefillNote}</div>
          ) : null}
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
              // Manual edit clears the chip selection so the
              // auto-calc effect won't overwrite the typed value
              // when the agent next adjusts offer price.
              onChange={(e) => {
                setEarnestMoney(e.target.value);
                setEarnestPct(null);
              }}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <PctChips
              value={earnestPct}
              options={[0.01, 0.02, 0.03, 0.05]}
              onChange={setEarnestPct}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Down payment</label>
            <input
              type="number"
              value={downPayment}
              onChange={(e) => {
                setDownPayment(e.target.value);
                setDownPct(null);
              }}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <PctChips
              value={downPct}
              options={[0.05, 0.1, 0.2, 0.25, 1]}
              onChange={setDownPct}
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

        <label className="inline-flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={submitNow}
            onChange={(e) => setSubmitNow(e.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span>
            <span className="font-medium text-slate-800">Already submitted to listing agent</span>
            <span className="mt-0.5 block text-[11px] text-slate-500">
              Skips the draft state and timestamps the offer as submitted now.
            </span>
          </span>
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

/**
 * Inline % chips under the earnest-money / down-payment fields.
 * Click a chip to set the dollar amount = offer × pct. Click the
 * active chip again to deselect (= "custom" / manual entry).
 *
 * Renders compact 10px buttons so the chip row fits inside the
 * 3-column grid on desktop without wrapping. Special-cases 100%
 * → "Cash" since "100%" reads as redundant for the all-cash case.
 */
function PctChips({
  value,
  options,
  onChange,
}: {
  value: number | null;
  options: number[];
  onChange: (next: number | null) => void;
}) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {options.map((pct) => {
        const active = value === pct;
        const label = pct === 1 ? "Cash" : `${Math.round(pct * 100)}%`;
        return (
          <button
            key={pct}
            type="button"
            onClick={() => onChange(active ? null : pct)}
            className={
              active
                ? "rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700"
                : "rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-200"
            }
            aria-pressed={active}
          >
            {label}
          </button>
        );
      })}
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
