"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import AddressAutocomplete, {
  type AddressAutocompleteValue,
} from "@/components/AddressAutocomplete";
import ContactPicker, { type ContactPickerValue } from "@/components/crm/ContactPicker";

/**
 * Slim shape returned by GET /api/dashboard/showings?contactId={uuid}.
 * Only the fields we need for the "prior address" quick-pick chips.
 */
type PriorAddress = {
  property_address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
};

/**
 * Listing-status check the form runs after a Google Places pick. The
 * agent should never schedule a showing on a deal that's already in
 * pending / sold / withdrawn — surface a banner so they can confirm
 * with the listing agent before sending the buyer.
 */
type StatusBanner = {
  tone: "ok" | "warn" | "info";
  text: string;
};

const ACTIVE_STATUS_RE = /^(active|active_under_contract|coming_soon|new)$/i;

/** Pick a string field from a loosely-typed property data blob, trying
 *  several common naming variants since the upstream listing source
 *  isn't strict. */
function readBlobString(blob: unknown, ...keys: string[]): string | null {
  if (!blob || typeof blob !== "object") return null;
  const obj = blob as Record<string, unknown>;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

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

  // Listing-status banner shown after a Google Places address pick.
  // Driven by /api/property/{address} → latest_snapshot.listing_status.
  // Cleared whenever the agent edits the address line again.
  const [statusBanner, setStatusBanner] = useState<StatusBanner | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  /**
   * Distinct addresses the buyer has been shown before. Populated when
   * the buyer is selected; rendered as quick-pick chips above the
   * address input so the agent doesn't have to retype an address the
   * buyer already toured. Most-recent first, capped at 5.
   */
  const [priorAddresses, setPriorAddresses] = useState<PriorAddress[]>([]);

  useEffect(() => {
    if (!contact?.id) {
      setPriorAddresses([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/dashboard/showings?contactId=${encodeURIComponent(contact.id)}`,
        );
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          showings?: Array<{
            property_address: string;
            city: string | null;
            state: string | null;
            zip: string | null;
            scheduled_at: string;
          }>;
        };
        if (cancelled || !body.ok) return;
        // Dedupe by property_address (case-insensitive). Most-recent
        // first because /api/dashboard/showings already orders by
        // scheduled_at desc; preserving order suffices.
        const seen = new Set<string>();
        const out: PriorAddress[] = [];
        for (const s of body.showings ?? []) {
          const key = (s.property_address ?? "").trim().toLowerCase();
          if (!key || seen.has(key)) continue;
          seen.add(key);
          out.push({
            property_address: s.property_address,
            city: s.city,
            state: s.state,
            zip: s.zip,
          });
          if (out.length >= 5) break;
        }
        setPriorAddresses(out);
      } catch {
        // Quick-pick is a nice-to-have; failures stay silent.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contact?.id]);

  /** Quick-pick a prior address. Skips Google but still validates the
   *  listing status against the property service. */
  function pickPriorAddress(addr: PriorAddress) {
    void onAddressPick({
      formattedAddress: addr.property_address,
      lat: null,
      lng: null,
      components: {
        streetNumber: null,
        streetName: null,
        city: addr.city,
        state: addr.state,
        zip: addr.zip,
      },
    });
  }

  /**
   * After Google Places returns a chosen Place, copy the parsed
   * city/state/zip into the form, then kick off a property-data lookup
   * to validate the listing is active and auto-fill anything else we
   * can scrape (MLS #, listing URL, agent name/email/phone).
   */
  async function onAddressPick(val: AddressAutocompleteValue) {
    setPropertyAddress(val.formattedAddress);
    if (val.components.city) setCity(val.components.city);
    if (val.components.state) setStateValue(val.components.state);
    if (val.components.zip) setZip(val.components.zip);

    setStatusBanner(null);
    setLookupLoading(true);
    try {
      const res = await fetch(
        `/api/property/${encodeURIComponent(val.formattedAddress)}`,
      );
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        latest_snapshot?: {
          listing_status?: string | null;
          data?: unknown;
        } | null;
      };
      if (!res.ok || !body.ok) {
        // Lookup failure is non-fatal; the agent can still submit.
        setStatusBanner({
          tone: "info",
          text: "Couldn't auto-verify listing status — fill in MLS # manually if you have it.",
        });
        return;
      }

      const status = body.latest_snapshot?.listing_status?.trim() || null;
      if (status) {
        if (ACTIVE_STATUS_RE.test(status)) {
          setStatusBanner({ tone: "ok", text: `Listing status: ${status}` });
        } else {
          setStatusBanner({
            tone: "warn",
            text: `Heads up — this listing is ${status}, not Active. Confirm with the listing agent before sending the buyer.`,
          });
        }
      } else {
        setStatusBanner({
          tone: "info",
          text: "No MLS status on file for this address — could be off-market or just not in our cache yet.",
        });
      }

      // Best-effort auto-fill from the data blob. Field names vary by
      // upstream listing source so we try a few common spellings.
      const blob = body.latest_snapshot?.data;
      const mls = readBlobString(blob, "mlsNumber", "mls_number", "mls", "mlsId");
      if (mls && !mlsNumber) setMlsNumber(mls);
      const url = readBlobString(blob, "listingUrl", "listing_url", "url");
      if (url && !mlsUrl) setMlsUrl(url);
      const agentName = readBlobString(
        blob,
        "listingAgentName",
        "listing_agent_name",
        "agentName",
      );
      if (agentName && !listingAgentName) setListingAgentName(agentName);
      const agentEmail = readBlobString(
        blob,
        "listingAgentEmail",
        "listing_agent_email",
        "agentEmail",
      );
      if (agentEmail && !listingAgentEmail) setListingAgentEmail(agentEmail);
      const agentPhone = readBlobString(
        blob,
        "listingAgentPhone",
        "listing_agent_phone",
        "agentPhone",
      );
      if (agentPhone && !listingAgentPhone) setListingAgentPhone(agentPhone);
    } catch {
      setStatusBanner({
        tone: "info",
        text: "Couldn't reach property service — proceed manually.",
      });
    } finally {
      setLookupLoading(false);
    }
  }

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

          {/* Quick-pick chips for prior showings with this buyer. Saves
              re-typing when the buyer is touring the same property a
              second time, or comparing a few favorites. Up to 5 most-
              recent unique addresses, populated when the buyer is
              selected. */}
          {priorAddresses.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Recent with this buyer:
              </span>
              {priorAddresses.map((p) => (
                <button
                  key={p.property_address}
                  type="button"
                  onClick={() => pickPriorAddress(p)}
                  className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  title="Use this address"
                >
                  {p.property_address}
                </button>
              ))}
            </div>
          ) : null}

          <AddressAutocomplete
            value={propertyAddress}
            onChange={(v) => {
              setPropertyAddress(v);
              // Edits after a pick invalidate the verified status —
              // clear the banner so the agent re-confirms on the next pick.
              if (statusBanner) setStatusBanner(null);
            }}
            onSelect={onAddressPick}
            placeholder="Start typing — Google will autocomplete the full address"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          {/* Parsed city/state/zip render as small chips beneath the
              input so the agent can see what got auto-filled (and that
              the values are populated). All three feed the submit body
              transparently — no manual entry needed unless Google
              missed a component. */}
          {(city || state || zip) ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
              {city ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5">{city}</span>
              ) : null}
              {state ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5">{state}</span>
              ) : null}
              {zip ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5">{zip}</span>
              ) : null}
            </div>
          ) : null}
          {lookupLoading ? (
            <p className="mt-1.5 text-[11px] text-slate-500">Looking up listing…</p>
          ) : null}
          {statusBanner ? (
            <div
              role="status"
              className={`mt-2 rounded-lg border px-3 py-2 text-xs ${
                statusBanner.tone === "warn"
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : statusBanner.tone === "ok"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              {statusBanner.text}
            </div>
          ) : null}
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
