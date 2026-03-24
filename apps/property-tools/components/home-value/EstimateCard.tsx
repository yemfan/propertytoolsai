"use client";

import { formatEstimateCurrency } from "@/lib/homeValue/estimateDisplay";
import type { HomeValueEstimateResponse } from "@/lib/homeValue/types";
import { ConfidenceBadge } from "./ConfidenceBadge";

type Props = {
  result: HomeValueEstimateResponse;
  isRefreshing?: boolean;
};

export function EstimateCard({ result, isRefreshing }: Props) {
  const { estimate, confidence, normalizedProperty } = result;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white via-slate-50/40 to-white p-6 shadow-xl shadow-slate-200/60 md:p-8">
      {isRefreshing ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[2px]">
          <div className="flex items-center gap-2 rounded-full bg-slate-900/90 px-4 py-2 text-sm font-medium text-white">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Updating estimate…
          </div>
        </div>
      ) : null}
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Estimated value</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">
            {formatEstimateCurrency(estimate.point)}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Range{" "}
            <span className="font-semibold text-slate-800">
              {formatEstimateCurrency(estimate.low)} – {formatEstimateCurrency(estimate.high)}
            </span>
          </p>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-600">{estimate.summary}</p>
        </div>
        <div className="flex flex-col items-start gap-3 md:items-end">
          <ConfidenceBadge confidence={confidence} />
          {normalizedProperty.address ? (
            <p className="max-w-xs text-right text-xs text-slate-500">{normalizedProperty.address}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
