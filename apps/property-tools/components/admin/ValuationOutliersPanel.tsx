"use client";

import { useEffect, useState } from "react";
import type { ValuationOutlierRow } from "@/lib/valuation-tracking/types";

function money(value?: number | null) {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function ValuationOutliersPanel() {
  const [rows, setRows] = useState<ValuationOutlierRow[]>([]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/valuation/outliers", { cache: "no-store" });
      const json = (await res.json()) as { success?: boolean; rows?: ValuationOutlierRow[] };
      if (json?.success) setRows(json.rows ?? []);
    })();
  }, []);

  if (!rows.length) {
    return (
      <section className="rounded-2xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">Largest Valuation Misses</h2>
        </div>
        <div className="p-5 text-sm text-gray-500">No sale outcomes recorded yet. Attach actual sales to track outliers.</div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border bg-white shadow-sm">
      <div className="border-b px-5 py-4">
        <h2 className="text-base font-semibold text-gray-900">Largest Valuation Misses</h2>
      </div>
      <div className="space-y-3 p-5">
        {rows.map((row) => (
          <div key={row.id} className="rounded-xl border p-4 text-sm">
            <div className="font-medium text-gray-900">{row.property_address}</div>
            <div className="mt-2 text-gray-600">
              Estimate {money(row.final_estimate)} • Sold {money(row.actual_sale_price)} • Error{" "}
              {(Number(row.error_pct ?? 0) * 100).toFixed(2)}%
            </div>
            <div className="mt-1 text-gray-500">
              {row.city}, {row.state} • {row.confidence_label} confidence • {row.comparable_count} comps •{" "}
              {row.tier_used ?? "n/a"}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
