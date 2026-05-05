"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import ContactPicker, { type ContactPickerValue } from "@/components/crm/ContactPicker";
import type { FinancingType } from "@/lib/offers/types";

/**
 * Mirror of the parse API's response shape — keep in sync with
 * apps/leadsmartai/app/api/dashboard/offers/parse/route.ts so type-
 * checked clients break loudly when the contract changes.
 */
type ParsedOffer = {
  propertyAddress: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  listPrice: number | null;
  offerPrice: number | null;
  earnestMoney: number | null;
  downPayment: number | null;
  financingType: FinancingType | null;
  closingDateProposed: string | null;
  offerExpiresAt: string | null;
  inspectionContingency: boolean | null;
  appraisalContingency: boolean | null;
  loanContingency: boolean | null;
  contingencyNotes: string | null;
  notes: string | null;
};

const MAX_INPUT_CHARS = 60_000;

function formatMoneyOrDash(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function summarize(parsed: ParsedOffer): { label: string; value: string }[] {
  return [
    { label: "Property", value: parsed.propertyAddress ?? "—" },
    { label: "City / State / ZIP", value: [parsed.city, parsed.state, parsed.zip].filter(Boolean).join(", ") || "—" },
    { label: "List price", value: formatMoneyOrDash(parsed.listPrice) },
    { label: "Offer price", value: formatMoneyOrDash(parsed.offerPrice) },
    { label: "Earnest money", value: formatMoneyOrDash(parsed.earnestMoney) },
    { label: "Down payment", value: formatMoneyOrDash(parsed.downPayment) },
    { label: "Financing", value: parsed.financingType ?? "—" },
    { label: "Proposed closing", value: parsed.closingDateProposed ?? "—" },
    { label: "Offer expires", value: parsed.offerExpiresAt ?? "—" },
    {
      label: "Inspection contingency",
      value:
        parsed.inspectionContingency == null
          ? "—"
          : parsed.inspectionContingency
            ? "WAIVED"
            : "kept",
    },
    {
      label: "Appraisal contingency",
      value:
        parsed.appraisalContingency == null
          ? "—"
          : parsed.appraisalContingency
            ? "WAIVED"
            : "kept",
    },
    {
      label: "Loan contingency",
      value:
        parsed.loanContingency == null
          ? "—"
          : parsed.loanContingency
            ? "WAIVED"
            : "kept",
    },
    { label: "Other contingencies", value: parsed.contingencyNotes ?? "—" },
    { label: "Notes", value: parsed.notes ?? "—" },
  ];
}

export function UploadOfferClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledContactId = searchParams.get("contactId") ?? "";

  const [contact, setContact] = useState<ContactPickerValue | null>(null);
  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedOffer | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 → AI parse only (no save). Agent reviews + saves below.
  async function runParse() {
    setError(null);
    setParsed(null);
    if (!text.trim()) {
      setError("Paste the offer text first.");
      return;
    }
    if (text.length > MAX_INPUT_CHARS) {
      setError(`That's ${text.length.toLocaleString()} characters — trim to ~${MAX_INPUT_CHARS.toLocaleString()} or less (offer + contingency pages, no boilerplate).`);
      return;
    }
    setParsing(true);
    try {
      const res = await fetch("/api/dashboard/offers/parse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        parsed?: ParsedOffer;
        error?: string;
      };
      if (!res.ok || !body.ok || !body.parsed) {
        setError(body.error ?? "Parse failed.");
        return;
      }
      setParsed(body.parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setParsing(false);
    }
  }

  // Step 2 → save the parsed offer as a draft. Re-uses the existing
  // /api/dashboard/offers POST so we don't duplicate validation.
  async function saveAsDraft() {
    if (!parsed) return;
    setError(null);
    if (!contact?.id) {
      setError("Pick a buyer before saving.");
      return;
    }
    if (!parsed.propertyAddress) {
      setError("AI couldn't extract a property address. Use + New offer to enter manually.");
      return;
    }
    if (parsed.offerPrice == null || parsed.offerPrice <= 0) {
      setError("AI couldn't extract a valid offer price. Use + New offer to enter manually.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/offers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contactId: contact.id,
          propertyAddress: parsed.propertyAddress,
          city: parsed.city,
          state: parsed.state,
          zip: parsed.zip,
          listPrice: parsed.listPrice,
          offerPrice: parsed.offerPrice,
          earnestMoney: parsed.earnestMoney,
          downPayment: parsed.downPayment,
          financingType: parsed.financingType,
          closingDateProposed: parsed.closingDateProposed,
          offerExpiresAt: parsed.offerExpiresAt,
          // null → fall back to the form defaults (true / true / true).
          inspectionContingency: parsed.inspectionContingency == null ? true : !parsed.inspectionContingency,
          appraisalContingency: parsed.appraisalContingency == null ? true : !parsed.appraisalContingency,
          loanContingency: parsed.loanContingency == null ? true : !parsed.loanContingency,
          contingencyNotes: parsed.contingencyNotes,
          notes: parsed.notes,
          submitNow: false,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        offer?: { id: string };
        error?: string;
      };
      if (!res.ok || !body.ok || !body.offer) {
        setError(body.error ?? "Failed to save offer.");
        return;
      }
      router.push(`/dashboard/offers/${body.offer.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <div className="text-xs text-slate-500">
          <Link href="/dashboard/offers" className="hover:underline">
            Offers
          </Link>
          {" / Upload"}
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Upload offer</h1>
        <p className="mt-1 text-sm text-slate-500">
          Paste the offer document — price, contingencies, dates, and key
          terms get extracted with AI. You review the result before saving.
        </p>
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <label className="block text-xs font-medium text-slate-700">Buyer *</label>
          <ContactPicker
            value={contact}
            onChange={setContact}
            initialContactId={prefilledContactId || null}
            helperText="Pick the buyer this offer is from."
            className="mt-1"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700">
            Offer document text *
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder={`Paste the full offer text here.

Tip: open your PDF, Cmd+A to select all, Cmd+C to copy, then paste into this box. We work with raw text — bullet points and page breaks are fine.`}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs leading-relaxed"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            {text.length.toLocaleString()} / {MAX_INPUT_CHARS.toLocaleString()} characters
          </p>
        </div>

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
            onClick={() => void runParse()}
            disabled={parsing || !text.trim()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {parsing ? "Parsing…" : parsed ? "Re-parse" : "Parse with AI"}
          </button>
        </div>
      </div>

      {parsed ? (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Extracted fields</h2>
            <p className="mt-1 text-[11px] text-slate-500">
              Review each field. The contingency rows show what the document says — “WAIVED” means the contract waives that contingency. Anything missing comes back as “—”; the new offer will use the form defaults for those.
            </p>
          </div>

          <dl className="divide-y divide-slate-100 text-sm">
            {summarize(parsed).map((row) => (
              <div key={row.label} className="grid grid-cols-3 gap-3 py-1.5">
                <dt className="col-span-1 text-slate-500">{row.label}</dt>
                <dd className="col-span-2 text-slate-900">{row.value}</dd>
              </div>
            ))}
          </dl>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => void saveAsDraft()}
              disabled={saving || !contact?.id || !parsed.propertyAddress || parsed.offerPrice == null}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save as draft"}
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            Saving creates an offer in <strong>draft</strong>. You can edit any
            field on the next page before flipping to “submitted.”
          </p>
        </div>
      ) : null}
    </div>
  );
}
