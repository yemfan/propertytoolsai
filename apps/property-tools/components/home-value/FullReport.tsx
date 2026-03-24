"use client";

import { compSupportLabel, formatEstimateCurrency } from "@/lib/homeValue/estimateDisplay";
import type { HomeValueEstimateResponse } from "@/lib/homeValue/types";
import { ConfidenceBadge } from "./ConfidenceBadge";

type Props = {
  result: HomeValueEstimateResponse;
};

export function FullReport({ result }: Props) {
  const { estimate, confidence, market, comps } = result;
  const compLabel = compSupportLabel(comps.pricedCount, comps.totalConsidered);

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Full valuation breakdown</h3>
            <p className="mt-1 text-sm text-slate-600">{compLabel}</p>
          </div>
          <ConfidenceBadge confidence={confidence} />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Adjustments</h4>
            <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100">
              {estimate.adjustments.map((a) => {
                const pct = (a.multiplier - 1) * 100;
                const pctLabel =
                  Math.abs(pct) < 0.05 ? "±0%" : `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
                return (
                  <li
                    key={a.key}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm"
                  >
                    <span className="text-slate-700">{a.label}</span>
                    <span className="tabular-nums text-slate-900">
                      <span className="font-semibold">×{a.multiplier.toFixed(3)}</span>
                      <span className="ml-2 text-xs font-normal text-slate-500">({pctLabel})</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Confidence factors</h4>
            <ul className="mt-3 space-y-2">
              {confidence.factors.map((f) => (
                <li
                  key={f.key}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2.5 text-sm text-slate-700"
                >
                  <span>{f.label}</span>
                  <span className="tabular-nums text-slate-500">{f.impact > 0 ? "+" : ""}{f.impact}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm leading-relaxed text-slate-600">{confidence.explanation}</p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 rounded-xl bg-slate-50 p-5 md:grid-cols-3">
          <div>
            <p className="text-xs font-medium text-slate-500">Baseline $/sqft</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              ${Math.round(estimate.baselinePpsf).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Market ({market.city}, {market.state})</p>
            <p className="mt-1 text-sm text-slate-700">
              Trend <span className="font-semibold capitalize">{market.trend}</span>
              {market.medianPrice != null ? (
                <>
                  {" "}
                  · Median {formatEstimateCurrency(market.medianPrice)}
                </>
              ) : null}
            </p>
            <p className="mt-1 text-xs text-slate-500">Source: {market.source}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Comparable coverage</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {comps.pricedCount} priced / {comps.totalConsidered} considered
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
