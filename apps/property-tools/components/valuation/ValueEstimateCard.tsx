"use client";

import type { ValuationResult } from "@/lib/valuation/types";

function money(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function ValueEstimateCard({ result }: { result: ValuationResult }) {
  return (
    <section className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
      <div className="text-sm text-gray-500">Estimated home value</div>
      <div className="mt-2 text-4xl font-semibold tracking-tight text-gray-900 md:text-5xl">
        {money(result.finalEstimate)}
      </div>
      <div className="mt-3 text-sm text-gray-600">
        Estimated range {money(result.lowEstimate)} – {money(result.highEstimate)}
      </div>
      <div className="mt-4 rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">
        Automated estimates should be treated as a range, not an exact sale price. Final value may vary based on
        condition, upgrades, micro-location, and current market demand.
      </div>
    </section>
  );
}
