"use client";

import { useEffect, useState } from "react";

type TopSeoRow = {
  slug: string;
  visit_count: number | null;
  lead_count: number | null;
  revenue_amount: number | null;
};

function formatMoney(n: number | null | undefined) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    Number(n)
  );
}

export function SeoRevenuePanel() {
  const [rows, setRows] = useState<TopSeoRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/admin/seo/top-pages")
      .then((r) => r.json())
      .then((d: { success?: boolean; rows?: TopSeoRow[]; error?: string }) => {
        if (!d.success) {
          setError(d.error || "Failed to load");
          return;
        }
        setRows(d.rows || []);
      })
      .catch(() => setError("Failed to load"));
  }, []);

  return (
    <div className="rounded-2xl border bg-white p-6">
      <h2 className="text-xl font-semibold text-gray-900">Top SEO pages (revenue)</h2>
      <p className="mt-1 text-sm text-gray-600">Programmatic landing pages ranked by attributed revenue.</p>

      {error ? (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">No published SEO pages yet or no revenue recorded.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {rows.map((row) => (
            <div key={row.slug} className="rounded-xl border border-gray-100 p-4">
              <div className="font-medium text-gray-900">/{row.slug}</div>
              <div className="mt-1 text-sm text-gray-600">
                Visits: {row.visit_count ?? 0} • Leads: {row.lead_count ?? 0}
              </div>
              <div className="mt-1 font-semibold text-green-700">Revenue: {formatMoney(row.revenue_amount)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
