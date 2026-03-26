"use client";

import type { ComparableSale } from "@/lib/valuation/types";

function money(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value) || value === 0) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function saleKey(comp: ComparableSale, index: number) {
  const id = String(comp.id ?? "").trim();
  return id || `comp-${index}`;
}

export function ComparableSalesPanel({ comps }: { comps: ComparableSale[] }) {
  return (
    <section className="rounded-3xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">Comparable sales used</h2>
      <div className="mt-4 space-y-3">
        {comps.length ? (
          comps.map((comp, index) => (
            <div key={saleKey(comp, index)} className="rounded-2xl border bg-gray-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-gray-900">{comp.address}</div>
                  <div className="mt-1 text-sm text-gray-600">
                    Sold {new Date(comp.soldDate).toLocaleDateString()} • {comp.beds ?? "—"} bd •{" "}
                    {comp.baths ?? "—"} ba • {comp.sqft?.toLocaleString() || "—"} sqft
                  </div>
                </div>
                <div className="text-right text-sm font-semibold text-gray-900">
                  {money(comp.soldPrice)}
                  <div className="mt-1 text-xs text-gray-500">
                    {comp.pricePerSqft ? `${money(comp.pricePerSqft)}/sqft` : "—"}
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-sm text-gray-500">No comparable sales available.</div>
        )}
      </div>
    </section>
  );
}
