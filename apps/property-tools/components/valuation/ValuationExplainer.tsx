"use client";

import type { ValuationResult } from "@/lib/valuation/types";

export function ValuationExplainer({ result }: { result: ValuationResult }) {
  return (
    <section className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
      <h2 className="text-xl font-semibold text-gray-900">How this estimate was calculated</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {result.factors.map((factor, i) => (
          <div key={`factor-${i}-${factor.label}`} className="rounded-2xl border bg-gray-50 p-4">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold text-gray-900">{factor.label}</div>
              <span
                className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                  factor.impact === "positive"
                    ? "bg-emerald-50 text-emerald-700"
                    : factor.impact === "negative"
                      ? "bg-red-50 text-red-700"
                      : "bg-gray-100 text-gray-700"
                }`}
              >
                {factor.impact}
              </span>
            </div>
            {factor.value != null && factor.value !== "" ? (
              <div className="mt-2 text-sm text-gray-900">{String(factor.value)}</div>
            ) : null}
            <div className="mt-2 text-sm text-gray-600">{factor.note}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
