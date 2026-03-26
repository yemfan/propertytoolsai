"use client";

import type { HomeValueHistoryItem } from "@/lib/home-value/history";

function formatCurrency(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function RecentHistory({
  items,
  onOpen,
}: {
  items: HomeValueHistoryItem[];
  onOpen: (sessionId: string) => void;
}) {
  if (!items.length) return null;

  return (
    <section className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Recent Estimates</h2>
          <p className="mt-2 text-sm text-gray-600">Reopen recent home value sessions instantly.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <button
            key={item.sessionId}
            type="button"
            onClick={() => onOpen(item.sessionId)}
            className="rounded-2xl border bg-gray-50 p-5 text-left transition hover:bg-white"
          >
            <div className="text-sm font-medium text-gray-900">{item.address.fullAddress}</div>

            <div className="mt-2 text-sm text-gray-500">
              {item.address.city}, {item.address.state} {item.address.zip}
            </div>

            <div className="mt-4 text-lg font-semibold text-gray-900">{formatCurrency(item.estimateValue)}</div>

            <div className="mt-1 text-xs text-gray-500">
              {formatCurrency(item.rangeLow)} - {formatCurrency(item.rangeHigh)}
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
              <span className="capitalize">{item.confidence ?? "—"} confidence</span>
              <span>{formatDate(item.savedAt)}</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
