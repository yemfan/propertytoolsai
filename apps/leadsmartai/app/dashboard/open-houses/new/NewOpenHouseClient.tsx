"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

function defaultDateIso(): string {
  // Saturday of this week — open houses are usually weekend events.
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  const daysUntilSat = (6 - day + 7) % 7 || 7; // always next Sat
  d.setDate(d.getDate() + daysUntilSat);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function NewOpenHouseClient() {
  const router = useRouter();

  const [propertyAddress, setPropertyAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setStateValue] = useState("CA");
  const [zip, setZip] = useState("");
  const [listPrice, setListPrice] = useState("");
  const [mlsNumber, setMlsNumber] = useState("");
  const [mlsUrl, setMlsUrl] = useState("");
  const [date, setDate] = useState(defaultDateIso());
  const [startTime, setStartTime] = useState("14:00");
  const [endTime, setEndTime] = useState("16:00");
  const [hostNotes, setHostNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { startAtIso, endAtIso } = useMemo(() => {
    if (!date || !startTime || !endTime) return { startAtIso: null, endAtIso: null };
    const start = new Date(`${date}T${startTime}:00`);
    const end = new Date(`${date}T${endTime}:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return { startAtIso: null, endAtIso: null };
    }
    return { startAtIso: start.toISOString(), endAtIso: end.toISOString() };
  }, [date, startTime, endTime]);

  async function submit() {
    setError(null);
    if (!propertyAddress.trim() || !startAtIso || !endAtIso) {
      setError("Property address, date, and time window are required.");
      return;
    }
    if (new Date(endAtIso).getTime() <= new Date(startAtIso).getTime()) {
      setError("End time must be after start time.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/dashboard/open-houses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          propertyAddress: propertyAddress.trim(),
          city: city.trim() || null,
          state: state.trim() || null,
          zip: zip.trim() || null,
          mlsNumber: mlsNumber.trim() || null,
          mlsUrl: mlsUrl.trim() || null,
          listPrice: listPrice ? Number(listPrice) : null,
          startAt: startAtIso,
          endAt: endAtIso,
          hostNotes: hostNotes.trim() || null,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        openHouse?: { id: string };
        error?: string;
      };
      if (!res.ok || !body.ok || !body.openHouse) {
        setError(body.error ?? "Failed to schedule.");
        return;
      }
      router.push(`/dashboard/open-houses/${body.openHouse.id}`);
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
          <Link href="/dashboard/open-houses" className="hover:underline">
            Open Houses
          </Link>
          {" / New"}
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Schedule open house</h1>
        <p className="mt-1 text-sm text-slate-500">
          After saving, you&apos;ll get a QR code and a sign-in URL to share at the door.
        </p>
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
              placeholder="1250000"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">MLS #</label>
            <input
              value={mlsNumber}
              onChange={(e) => setMlsNumber(e.target.value)}
              placeholder="ML12345678"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700">Listing URL</label>
          <input
            value={mlsUrl}
            onChange={(e) => setMlsUrl(e.target.value)}
            placeholder="https://…"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            Shown on the sign-in page as &quot;View listing&quot; — visitors can save the link.
          </p>
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
            <label className="block text-xs font-medium text-slate-700">Start *</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">End *</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700">Host notes</label>
          <textarea
            value={hostNotes}
            onChange={(e) => setHostNotes(e.target.value)}
            rows={2}
            placeholder="Parking out back, skip the garage, keep the cat inside, etc."
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Link
            href="/dashboard/open-houses"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting || !propertyAddress.trim() || !startAtIso || !endAtIso}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create open house"}
          </button>
        </div>
      </div>
    </div>
  );
}
