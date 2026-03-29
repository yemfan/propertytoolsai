"use client";

import { formatCurrency, type EstimateResponse, type UnlockReportResponse } from "@/lib/home-value/types";

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-5">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm text-gray-700">
      <span>{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export function FullReport({
  estimate,
  unlockResult,
}: {
  estimate: EstimateResponse | null;
  unlockResult: UnlockReportResponse | null;
}) {
  if (!estimate || !unlockResult) return null;

  const est = unlockResult.report.estimate;
  const score = Math.round(est.confidenceScore);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            Full Report Unlocked
          </div>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-gray-900 md:text-3xl">
            Detailed Valuation Report
          </h2>
        </div>

        <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
          {unlockResult.leadId === "—" ? (
            <span>Lead on file — reference ID from your confirmation email if needed.</span>
          ) : (
            <>
              Lead ID: <span className="font-mono font-medium">{unlockResult.leadId}</span>
            </>
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <MetricCard label="Estimated Value" value={formatCurrency(est.value)} />
        <MetricCard
          label="Value Range"
          value={`${formatCurrency(est.rangeLow)} – ${formatCurrency(est.rangeHigh)}`}
        />
        <MetricCard
          label="Confidence"
          value={`${est.confidence} (${score}/100)`}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 p-5">
          <h3 className="text-base font-semibold text-gray-900">Market Snapshot</h3>
          <div className="mt-4 space-y-3">
            <Row
              label="Median Price / Sqft"
              value={
                unlockResult.report.market?.medianPpsf
                  ? `${formatCurrency(unlockResult.report.market.medianPpsf)}/sqft`
                  : "—"
              }
            />
            <Row
              label="Local Trend"
              value={
                typeof unlockResult.report.market?.localTrendPct === "number"
                  ? `${(unlockResult.report.market.localTrendPct * 100).toFixed(1)}%`
                  : "—"
              }
            />
            <Row
              label="Comparable Data Points"
              value={String(unlockResult.report.market?.compCount ?? "—")}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 p-5">
          <h3 className="text-base font-semibold text-gray-900">What This Means</h3>
          <p className="mt-4 text-sm leading-relaxed text-gray-700">
            Based on local pricing, property details, and available market coverage, this estimate suggests where the
            home likely sits in the current market. Use the range, confidence level, and next-step tools to evaluate
            whether you are selling, buying, or investing.
          </p>
        </div>
      </div>
    </section>
  );
}
