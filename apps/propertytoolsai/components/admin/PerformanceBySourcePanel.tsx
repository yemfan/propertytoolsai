"use client";

import { useEffect, useState } from "react";
import type { SourcePerformanceRow } from "@/lib/performance/types";

export function PerformanceBySourcePanel() {
  const [rows, setRows] = useState<SourcePerformanceRow[]>([]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/performance/by-source", { cache: "no-store" });
      const json = await res.json();
      if (json?.success) setRows((json.rows as SourcePerformanceRow[]) || []);
    })();
  }, []);

  if (!rows.length) {
    return (
      <section className="rounded-2xl border bg-white p-5 text-sm text-gray-500 shadow-sm">
        No source breakdown yet — add leads with a <code className="text-xs">source</code> value.
      </section>
    );
  }

  return (
    <section className="rounded-2xl border bg-white shadow-sm">
      <div className="border-b px-5 py-4">
        <h2 className="text-base font-semibold text-gray-900">Performance by Source</h2>
      </div>
      <div className="space-y-3 p-5">
        {rows.map((row) => (
          <div key={row.source} className="rounded-xl border p-4 text-sm">
            <div className="font-medium text-gray-900">{row.source}</div>
            <div className="mt-2 text-gray-600">
              Leads {row.leads} • Hot {row.hotLeads} • Conversions {row.conversions} • Conv. Rate{" "}
              {row.conversionRate}% • Avg Score {row.avgLeadScore}
            </div>
            <div className="mt-1 font-medium text-gray-900">Revenue {formatMoney(row.grossRevenue)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}
