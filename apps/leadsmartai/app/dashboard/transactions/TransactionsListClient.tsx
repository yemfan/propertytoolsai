"use client";

import Link from "next/link";
import { useState } from "react";
import type { TransactionListItem } from "@/lib/transactions/types";

function daysUntil(dateIso: string | null): number | null {
  if (!dateIso) return null;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const target = new Date(`${dateIso}T00:00:00Z`);
  const ms = target.getTime() - today.getTime();
  return Math.round(ms / 86_400_000);
}

function statusStyle(status: string): string {
  switch (status) {
    case "active":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "closed":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "terminated":
      return "bg-red-50 text-red-700 border-red-200";
    case "pending":
      return "bg-amber-50 text-amber-800 border-amber-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

export function TransactionsListClient({
  initialItems,
}: {
  initialItems: TransactionListItem[];
}) {
  const [items] = useState(initialItems);
  const [filter, setFilter] = useState<"active" | "all">("active");

  const visible = filter === "all" ? items : items.filter((t) => t.status === "active");

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Transactions</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every deal from mutual acceptance through close — deadlines, tasks,
            counterparties in one place.
          </p>
        </div>
        <Link
          href="/dashboard/transactions/new"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          New transaction
        </Link>
      </header>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setFilter("active")}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            filter === "active"
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
          }`}
        >
          Active ({items.filter((t) => t.status === "active").length})
        </button>
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            filter === "all"
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
          }`}
        >
          All ({items.length})
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-900">
            {items.length === 0 ? "No transactions yet." : "No transactions match this filter."}
          </p>
          {items.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">
              Create one for a buyer who just had an offer accepted, or for any active deal you
              want to track in one place.
            </p>
          ) : null}
          <Link
            href="/dashboard/transactions/new"
            className="mt-4 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            New transaction
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 text-left font-semibold">Property</th>
                <th className="px-5 py-3 text-left font-semibold">Client</th>
                <th className="px-5 py-3 text-left font-semibold">Status</th>
                <th className="px-5 py-3 text-left font-semibold">Closing</th>
                <th className="px-5 py-3 text-left font-semibold">Tasks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((t) => {
                const days = daysUntil(t.closing_date);
                const closingLabel = t.closing_date
                  ? `${t.closing_date}${days != null ? ` · ${days >= 0 ? `${days}d` : `${-days}d past`}` : ""}`
                  : "—";
                return (
                  <tr key={t.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <Link
                        href={`/dashboard/transactions/${t.id}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {t.property_address}
                      </Link>
                      {t.city ? (
                        <div className="text-xs text-slate-500">
                          {t.city}
                          {t.state ? `, ${t.state}` : ""}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-5 py-3 text-slate-700">{t.contact_name ?? "—"}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyle(t.status)}`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-700">{closingLabel}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-600">
                          {t.task_completed}/{t.task_total}
                        </span>
                        {t.task_overdue > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                            {t.task_overdue} overdue
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
