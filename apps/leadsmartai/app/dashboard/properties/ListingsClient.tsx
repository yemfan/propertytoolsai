"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ListingListItem } from "@/lib/listings/service";
import type { TransactionStatus } from "@/lib/transactions/types";

type StatusFilter = "all" | "active" | "pending" | "closed";

const STATUS_LABEL: Record<TransactionStatus, string> = {
  active: "Active",
  pending: "Pending",
  closed: "Closed",
  terminated: "Terminated",
};

const STATUS_BADGE: Record<TransactionStatus, string> = {
  active: "bg-emerald-100 text-emerald-800",
  pending: "bg-blue-100 text-blue-800",
  closed: "bg-slate-200 text-slate-700",
  terminated: "bg-rose-100 text-rose-800",
};

function formatPrice(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(ymd: string | null): string {
  if (!ymd) return "—";
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatRelativeShowing(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "—";
  const diffDays = Math.round((Date.now() - ms) / 86_400_000);
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays > 0 && diffDays <= 30) return `${diffDays}d ago`;
  if (diffDays < 0 && diffDays >= -30) return `in ${-diffDays}d`;
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function ListingsClient({
  listings,
}: {
  listings: ListingListItem[];
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    return listings.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        l.property_address.toLowerCase().includes(q) ||
        (l.city ?? "").toLowerCase().includes(q) ||
        (l.state ?? "").toLowerCase().includes(q)
      );
    });
  }, [listings, search, statusFilter]);

  /**
   * KPI strip totals — active count, total showings across active
   * listings, upcoming showings (any status). The "active showings"
   * roll-up restricts to status='active' so closed deals don't pad
   * the number; "upcoming" deliberately stays cross-status because
   * even pending deals can have late visits before COE.
   */
  const stats = useMemo(() => {
    let active = 0;
    let activeShowings = 0;
    let upcoming = 0;
    for (const l of listings) {
      if (l.status === "active") {
        active += 1;
        activeShowings += l.showings_total;
      }
      upcoming += l.showings_upcoming;
    }
    return { active, activeShowings, upcoming, total: listings.length };
  }, [listings]);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Listings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Your listing-side inventory. Rows roll up showings activity per
            property — click an address to open the deal.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/transactions/new?type=listing_rep&focus=upload"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            title="Drop a signed listing agreement (RLA) PDF — we'll auto-fill the address, list price, and listing dates."
          >
            ⬆ Upload listing agreement
          </Link>
          <Link
            href="/dashboard/transactions/new?type=listing_rep"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            + New listing
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total" value={stats.total} />
        <Stat label="Active" value={stats.active} tone="green" />
        <Stat label="Showings (active)" value={stats.activeShowings} tone="blue" />
        <Stat label="Upcoming showings" value={stats.upcoming} tone="amber" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search address, city, state…"
          className="min-w-[240px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        >
          <option value="all">All listings</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Property</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Price</th>
                <th className="px-3 py-2 text-left font-medium">Listed</th>
                <th className="px-3 py-2 text-left font-medium">Showings</th>
                <th className="px-3 py-2 text-left font-medium">Closing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((l) => (
                <tr key={l.id} className="align-top hover:bg-slate-50">
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/dashboard/listings/${l.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {l.property_address}
                    </Link>
                    {l.city || l.state ? (
                      <div className="text-[11px] text-slate-500">
                        {[l.city, l.state].filter(Boolean).join(", ")}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE[l.status]}`}
                    >
                      {STATUS_LABEL[l.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-700 tabular-nums">
                    {formatPrice(l.list_price)}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">
                    {formatDate(l.listing_start_date)}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {l.showings_total === 0 ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <div>
                        <div className="font-medium text-slate-700 tabular-nums">
                          {l.showings_total} total
                          {l.showings_upcoming > 0 ? (
                            <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                              {l.showings_upcoming} upcoming
                            </span>
                          ) : null}
                        </div>
                        {l.last_showing_at ? (
                          <div className="text-[11px] text-slate-500">
                            last: {formatRelativeShowing(l.last_showing_at)}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">
                    {/* Prefer the actual close date once recorded; fall back to scheduled. */}
                    {formatDate(l.closing_date_actual ?? l.closing_date)}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-sm text-slate-500">
                    {listings.length === 0 ? (
                      <>
                        <div className="font-medium">No listings yet.</div>
                        <div className="mt-1 text-[12px]">
                          Click <strong>+ New listing</strong> to create your first
                          listing-rep deal.
                        </div>
                      </>
                    ) : (
                      "No listings match your filters."
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

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "blue" | "green" | "red" | "amber";
}) {
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
