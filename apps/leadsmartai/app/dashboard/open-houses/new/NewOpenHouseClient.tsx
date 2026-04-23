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

const WEEKDAYS = [
  { n: 0, label: "Sun" },
  { n: 1, label: "Mon" },
  { n: 2, label: "Tue" },
  { n: 3, label: "Wed" },
  { n: 4, label: "Thu" },
  { n: 5, label: "Fri" },
  { n: 6, label: "Sat" },
];

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

  // Recurrence controls
  const [isRecurring, setIsRecurring] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([6]); // Sat by default
  const [weeks, setWeeks] = useState(4);

  const { startAtIso, endAtIso } = useMemo(() => {
    if (!date || !startTime || !endTime) return { startAtIso: null, endAtIso: null };
    const start = new Date(`${date}T${startTime}:00`);
    const end = new Date(`${date}T${endTime}:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return { startAtIso: null, endAtIso: null };
    }
    return { startAtIso: start.toISOString(), endAtIso: end.toISOString() };
  }, [date, startTime, endTime]);

  const projectedCount = useMemo(() => {
    if (!isRecurring) return 1;
    return Math.min(26, Math.max(0, weekdays.length * weeks));
  }, [isRecurring, weekdays, weeks]);

  async function submit() {
    setError(null);
    if (!propertyAddress.trim() || !date || !startTime || !endTime) {
      setError("Property address, date, and time window are required.");
      return;
    }
    if (isRecurring) {
      if (!weekdays.length) {
        setError("Pick at least one weekday for the recurrence.");
        return;
      }
      if (weeks <= 0) {
        setError("Number of weeks must be at least 1.");
        return;
      }
    } else {
      if (!startAtIso || !endAtIso) {
        setError("Invalid date/time.");
        return;
      }
      if (new Date(endAtIso).getTime() <= new Date(startAtIso).getTime()) {
        setError("End time must be after start time.");
        return;
      }
    }
    setSubmitting(true);
    try {
      const base = {
        propertyAddress: propertyAddress.trim(),
        city: city.trim() || null,
        state: state.trim() || null,
        zip: zip.trim() || null,
        mlsNumber: mlsNumber.trim() || null,
        mlsUrl: mlsUrl.trim() || null,
        listPrice: listPrice ? Number(listPrice) : null,
        hostNotes: hostNotes.trim() || null,
      };
      const body = isRecurring
        ? {
            ...base,
            recurrence: {
              kind: "weekly" as const,
              anchorDate: date,
              weekdays,
              weeks,
              startTime,
              endTime,
            },
          }
        : {
            ...base,
            startAt: startAtIso,
            endAt: endAtIso,
          };
      const res = await fetch("/api/dashboard/open-houses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        openHouse?: { id: string };
        openHouses?: Array<{ id: string }>;
        recurring?: boolean;
        count?: number;
        error?: string;
      };
      if (!res.ok || !payload.ok) {
        setError(payload.error ?? "Failed to schedule.");
        return;
      }
      // Recurring: jump to the list so all N show up with the series badge.
      // Single: jump to the detail page.
      if (payload.recurring && payload.openHouses?.length) {
        router.push("/dashboard/open-houses");
      } else if (payload.openHouse) {
        router.push(`/dashboard/open-houses/${payload.openHouse.id}`);
      } else {
        router.push("/dashboard/open-houses");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  const toggleWeekday = (n: number) => {
    setWeekdays((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n].sort(),
    );
  };

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

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-2">
            <input
              id="recurring-toggle"
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            <label htmlFor="recurring-toggle" className="text-sm font-medium text-slate-800">
              Recurring series
            </label>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Create N open houses at once — one row per occurrence, each with its own sign-in URL.
          </p>
        </div>

        {!isRecurring ? (
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
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  First occurrence date *
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Anchor — pattern walks forward from here.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Number of weeks *
                </label>
                <input
                  type="number"
                  min={1}
                  max={13}
                  value={weeks}
                  onChange={(e) => setWeeks(Math.max(1, Math.min(13, Number(e.target.value) || 1)))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Weekdays *</label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {WEEKDAYS.map((w) => {
                  const selected = weekdays.includes(w.n);
                  return (
                    <button
                      key={w.n}
                      type="button"
                      onClick={() => toggleWeekday(w.n)}
                      className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                        selected
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {w.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
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
            <div className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-800">
              Will create <strong>{projectedCount}</strong> open house
              {projectedCount === 1 ? "" : "s"} (capped at 26).
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-700">Host notes</label>
          <textarea
            value={hostNotes}
            onChange={(e) => setHostNotes(e.target.value)}
            rows={2}
            placeholder="Parking out back, skip the garage, keep the cat inside, etc."
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            Host notes + property details are copied to every occurrence in the series.
          </p>
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
            disabled={submitting || !propertyAddress.trim() || projectedCount === 0}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting
              ? "Creating…"
              : isRecurring
                ? `Create ${projectedCount} open house${projectedCount === 1 ? "" : "s"}`
                : "Create open house"}
          </button>
        </div>
      </div>
    </div>
  );
}
