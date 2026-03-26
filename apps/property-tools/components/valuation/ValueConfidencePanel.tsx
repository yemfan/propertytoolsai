"use client";

import type { ValuationResult } from "@/lib/valuation/types";

function badge(label: string) {
  if (label === "high") return "bg-emerald-50 text-emerald-700";
  if (label === "medium") return "bg-amber-50 text-amber-700";
  return "bg-red-50 text-red-700";
}

export function ValueConfidencePanel({ result }: { result: ValuationResult }) {
  return (
    <section className="rounded-3xl border bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-gray-900">Confidence</h2>
        <span className={`rounded-full px-3 py-1 text-sm font-medium capitalize ${badge(result.confidenceLabel)}`}>
          {result.confidenceLabel} · {result.confidenceScore}/100
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Comparable sales" value={String(result.comparableCount)} />
        <Metric label="Weighted price/sqft" value={result.weightedPpsf ? `$${result.weightedPpsf}` : "—"} />
        <Metric label="API estimate" value={result.apiEstimate ? `$${result.apiEstimate}` : "—"} />
        <Metric label="Comps estimate" value={result.compsEstimate ? `$${result.compsEstimate}` : "—"} />
      </div>

      {result.warnings.length ? (
        <div className="mt-4 space-y-2">
          {result.warnings.map((warning, i) => (
            <div
              key={`warning-${i}`}
              className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
            >
              {warning}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-gray-50 p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-gray-900">{value}</div>
    </div>
  );
}
