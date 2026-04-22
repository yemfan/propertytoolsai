"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import ContactPicker, { type ContactPickerValue } from "@/components/crm/ContactPicker";

/**
 * Schedule a new showing. Accepts `?contactId=<uuid>` for deep-link
 * prefill (e.g. from the Contacts page "Schedule showing" action or
 * from the Showings list filter).
 *
 * Time is captured as a date + time input pair rather than a datetime-
 * local because real-estate showings are always same-day — agents think
 * "Saturday at 2pm," not "2026-05-15T14:00." Combining the two into a
 * timestamptz happens at submit time.
 */

function NewShowingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledContactId = searchParams.get("contactId") ?? "";

  const [contact, setContact] = useState<ContactPickerValue | null>(null);
  const [propertyAddress, setPropertyAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setStateValue] = useState("CA");
  const [zip, setZip] = useState("");
  const [mlsUrl, setMlsUrl] = useState("");
  const [mlsNumber, setMlsNumber] = useState("");
  const [date, setDate] = useState(defaultDateIso());
  const [time, setTime] = useState("14:00");
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [accessNotes, setAccessNotes] = useState("");
  const [listingAgentName, setListingAgentName] = useState("");
  const [listingAgentEmail, setListingAgentEmail] = useState("");
  const [listingAgentPhone, setListingAgentPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scheduledAtIso = useMemo(() => {
    if (!date || !time) return null;
    // Combine as local time then toISOString — agent's browser locale is
    // the authoritative one. Agents in PT scheduling 2pm means PT 2pm.
    const dt = new Date(`${date}T${time}:00`);
    return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
  }, [date, time]);

  async function submit() {
    setError(null);
    if (!contact?.id || !propertyAddress.trim() || !scheduledAtIso) {
      setError("Buyer, property address, and date+time are required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/dashboard/showings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contactId: contact.id,
          propertyAddress: propertyAddress.trim(),
          city: city.trim() || null,
          state: state.trim() || null,
          zip: zip.trim() || null,
          mlsNumber: mlsNumber.trim() || null,
          mlsUrl: mlsUrl.trim() || null,
          scheduledAt: scheduledAtIso,
          durationMinutes: durationMinutes ? Number(durationMinutes) : null,
          accessNotes: accessNotes.trim() || null,
          listingAgentName: listingAgentName.trim() || null,
          listingAgentEmail: listingAgentEmail.trim() || null,
          listingAgentPhone: listingAgentPhone.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        showing?: { id: string };
        error?: string;
      };
      if (!res.ok || !body.ok || !body.showing) {
        setError(body.error ?? "Failed to schedule showing.");
        return;
      }
      router.push(`/dashboard/showings/${body.showing.id}`);
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
          <Link href="/dashboard/showings" className="hover:underline">
            Showings
          </Link>
          {" / New"}
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Schedule showing</h1>
        <p className="mt-1 text-sm text-slate-500">
          Log a property visit with a buyer. After the showing, capture their feedback
          for your file + next-steps conversation.
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

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700">Date *</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Time *</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Duration (min)</label>
            <input
              type="number"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              min={5}
              max={240}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700">MLS #</label>
            <input
              value={mlsNumber}
              onChange={(e) => setMlsNumber(e.target.value)}
              placeholder="ML12345678"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Listing URL</label>
            <input
              value={mlsUrl}
              onChange={(e) => setMlsUrl(e.target.value)}
              placeholder="https://…"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700">Access notes</label>
          <input
            value={accessNotes}
            onChange={(e) => setAccessNotes(e.target.value)}
            placeholder="Lockbox 1234, gate open, side door"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            Copy from ShowingTime / CSS confirmation. Saved on this showing only.
          </p>
        </div>

        <div className="space-y-3 rounded-lg bg-slate-50 p-3">
          <div className="text-xs font-medium text-slate-700">Listing agent contact</div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-slate-500">Name</label>
              <input
                value={listingAgentName}
                onChange={(e) => setListingAgentName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500">Email</label>
              <input
                type="email"
                value={listingAgentEmail}
                onChange={(e) => setListingAgentEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500">Phone</label>
              <input
                value={listingAgentPhone}
                onChange={(e) => setListingAgentPhone(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </div>
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
            href="/dashboard/showings"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting || !contact?.id || !propertyAddress.trim() || !scheduledAtIso}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? "Scheduling…" : "Schedule showing"}
          </button>
        </div>
      </div>
    </div>
  );
}

function defaultDateIso(): string {
  // Today in the user's locale. date inputs want YYYY-MM-DD.
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function NewShowingClient() {
  return (
    <Suspense fallback={<div className="text-sm text-slate-500">Loading…</div>}>
      <NewShowingForm />
    </Suspense>
  );
}
