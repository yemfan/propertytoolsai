"use client";

import Link from "next/link";
import {
  compSupportLabel,
  formatEstimateCurrency,
  HOME_VALUE_DISCLAIMER_SHORT,
} from "@/lib/homeValue/estimateDisplay";
import type { HomeValueEstimateResponse } from "@/lib/homeValue/types";

type Props = {
  result: HomeValueEstimateResponse;
  onStartOver: () => void;
};

export default function ResultStep({ result, onStartOver }: Props) {
  const { estimate, confidence, market, comps, recommendations } = result;

  const internalRecs = recommendations.filter((r) => r.href.startsWith("/"));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">Your full breakdown</h2>
        <p className="mt-2 text-sm text-gray-600">
          Estimated value and range below are generated from market baselines and your inputs — useful for planning, not a
          substitute for an appraisal.
        </p>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Estimated value</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{formatEstimateCurrency(estimate.point)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Estimated range</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-gray-900">
              {formatEstimateCurrency(estimate.low)} – {formatEstimateCurrency(estimate.high)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Confidence</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {confidence.level} · {Math.round(confidence.score)}/100
            </p>
          </div>
        </div>
        <p className="mt-4 text-sm text-gray-600">{estimate.summary}</p>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900">What moved the estimate</h3>
        <p className="mt-1 text-sm text-gray-600">
          Each line is a multiplier applied to a local price-per-sqft baseline, then anchored to your living area.
        </p>
        <ul className="mt-4 divide-y divide-gray-100 rounded-2xl border border-gray-100">
          {estimate.adjustments.map((a) => (
            <li key={a.key} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <span className="text-gray-700">{a.label}</span>
              <span className="tabular-nums text-gray-900">×{a.multiplier.toFixed(3)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-gray-500">Baseline ~${Math.round(estimate.baselinePpsf).toLocaleString()}/sqft</p>
      </div>

      <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-gray-700">
        <span className="font-semibold text-gray-900">Comparable sales: </span>
        {compSupportLabel(comps.pricedCount, comps.totalConsidered)}
      </div>

      {confidence.factors?.length ? (
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Confidence factors</h3>
          <ul className="mt-2 space-y-2 text-sm text-gray-600">
            {confidence.factors.map((f) => (
              <li key={f.key}>
                <span className="font-medium text-gray-800">{f.label}</span> — impact {f.impact}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {market.city && market.city !== "Unknown" ? (
        <p className="text-sm text-gray-600">
          <span className="font-medium text-gray-900">Market:</span> {market.city}, {market.state} · median context where
          available · trend: {market.trend}
        </p>
      ) : null}

      {internalRecs.length > 0 ? (
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Related tools</h3>
          <ul className="mt-3 space-y-2">
            {internalRecs.slice(0, 4).map((r) => (
              <li key={r.href + r.title}>
                <Link href={r.href} className="text-sm font-medium text-[#0072ce] hover:underline">
                  {r.title}
                </Link>
                <p className="text-xs text-gray-500">{r.reason}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="rounded-xl border border-amber-100 bg-amber-50/80 px-4 py-3 text-xs leading-relaxed text-amber-950">
        {HOME_VALUE_DISCLAIMER_SHORT}
      </p>

      <button
        type="button"
        onClick={onStartOver}
        className="w-full rounded-2xl border border-gray-200 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50"
      >
        Estimate another address
      </button>
    </div>
  );
}
