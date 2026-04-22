"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ShowingListItem, ShowingStatus } from "@/lib/showings/types";

type Filter = "all" | "upcoming" | "attended" | "cancelled";

const STATUS_LABEL: Record<ShowingStatus, string> = {
  scheduled: "Scheduled",
  attended: "Attended",
  cancelled: "Cancelled",
  no_show: "No show",
};

const STATUS_BADGE: Record<ShowingStatus, string> = {
  scheduled: "bg-blue-100 text-blue-800",
  attended: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-600",
  no_show: "bg-amber-100 text-amber-800",
};

const REACTION_EMOJI: Record<string, string> = {
  love: "❤️",
  like: "👍",
  maybe: "🤔",
  pass: "👎",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function ShowingsListClient({
  initialShowings,
  initialContactFilter,
}: {
  initialShowings: ShowingListItem[];
  initialContactFilter: string | null;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const contactFilterName = useMemo(() => {
    if (!initialContactFilter) return null;
    const match = initialShowings.find((s) => s.contact_id === initialContactFilter);
    return match?.contact_name ?? "selected buyer";
  }, [initialContactFilter, initialShowings]);

  const filtered = useMemo(() => {
    const now = Date.now();
    return initialShowings.filter((s) => {
      if (filter === "upcoming" && (s.status !== "scheduled" || new Date(s.scheduled_at).getTime() < now)) return false;
      if (filter === "attended" && s.status !== "attended") return false;
      if (filter === "cancelled" && s.status !== "cancelled" && s.status !== "no_show") return false;

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        s.property_address.toLowerCase().includes(q) ||
        (s.city ?? "").toLowerCase().includes(q) ||
        (s.contact_name ?? "").toLowerCase().includes(q) ||
        (s.listing_agent_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [initialShowings, filter, search]);

  const stats = useMemo(() => {
    const now = Date.now();
    let upcoming = 0;
    let attended = 0;
    let loved = 0;
    let wouldOffer = 0;
    for (const s of initialShowings) {
      if (s.status === "scheduled" && new Date(s.scheduled_at).getTime() >= now) upcoming += 1;
      if (s.status === "attended") attended += 1;
      if (s.feedback_reaction === "love") loved += 1;
      if (s.feedback_would_offer) wouldOffer += 1;
    }
    return { total: initialShowings.length, upcoming, attended, loved, wouldOffer };
  }, [initialShowings]);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Showings</h1>
          <p className="mt-1 text-sm text-slate-500">
            {contactFilterName ? (
              <>
                Showing visits for <strong>{contactFilterName}</strong>.{" "}
                <Link href="/dashboard/showings" className="text-blue-600 hover:underline">
                  Clear filter
                </Link>
              </>
            ) : (
              "Buyer-side property visits — schedule, track, capture feedback."
            )}
          </p>
        </div>
        <Link
          href={
            initialContactFilter
              ? `/dashboard/showings/new?contactId=${encodeURIComponent(initialContactFilter)}`
              : "/dashboard/showings/new"
          }
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          + Schedule showing
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Total" value={stats.total} />
        <Stat label="Upcoming" value={stats.upcoming} tone="blue" />
        <Stat label="Attended" value={stats.attended} tone="green" />
        <Stat label="Loved" value={stats.loved} tone="red" />
        <Stat label="Would offer" value={stats.wouldOffer} tone="amber" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search address, buyer, listing agent…"
          className="min-w-[240px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        >
          <option value="all">All showings</option>
          <option value="upcoming">Upcoming</option>
          <option value="attended">Attended</option>
          <option value="cancelled">Cancelled / no-show</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left font-medium">When</th>
                <th className="px-3 py-2 text-left font-medium">Property</th>
                <th className="px-3 py-2 text-left font-medium">Buyer</th>
                <th className="px-3 py-2 text-left font-medium">Listing agent</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Feedback</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((s) => (
                <tr key={s.id} className="align-top hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-2">
                    <Link href={`/dashboard/showings/${s.id}`} className="block">
                      <div className="font-medium text-slate-900">{formatDate(s.scheduled_at)}</div>
                      <div className="text-[11px] text-slate-500">{formatTime(s.scheduled_at)}</div>
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/dashboard/showings/${s.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {s.property_address}
                    </Link>
                    {s.city || s.state ? (
                      <div className="text-[11px] text-slate-500">
                        {[s.city, s.state].filter(Boolean).join(", ")}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{s.contact_name ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {s.listing_agent_name ? (
                      <div>{s.listing_agent_name}</div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                    {s.listing_agent_email ? (
                      <div className="text-[11px] text-slate-500">{s.listing_agent_email}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE[s.status]}`}
                    >
                      {STATUS_LABEL[s.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {s.feedback_reaction ? (
                      <div className="flex items-center gap-1 text-xs">
                        <span>{REACTION_EMOJI[s.feedback_reaction]}</span>
                        {s.feedback_rating ? (
                          <span className="tabular-nums text-slate-600">{s.feedback_rating}/5</span>
                        ) : null}
                        {s.feedback_would_offer ? (
                          <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                            offer
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-sm text-slate-500">
                    {initialShowings.length === 0 ? (
                      <>
                        <div className="font-medium">No showings yet.</div>
                        <div className="mt-1 text-[12px]">
                          Click <strong>+ Schedule showing</strong> to log a buyer&apos;s first property visit.
                        </div>
                      </>
                    ) : (
                      "No showings match your filters."
                    )}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "blue" | "green" | "red" | "amber" }) {
  const color =
    tone === "blue"
      ? "text-blue-700"
      : tone === "green"
        ? "text-green-700"
        : tone === "red"
          ? "text-red-600"
          : tone === "amber"
            ? "text-amber-700"
            : "text-slate-900";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="text-[11px] font-medium text-slate-500">{label}</div>
      <div className={`text-xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}
