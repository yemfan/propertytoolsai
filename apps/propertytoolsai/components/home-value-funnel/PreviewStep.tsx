"use client";

import { formatEstimateCurrency, HOME_VALUE_DISCLAIMER_SHORT } from "@/lib/homeValue/estimateDisplay";
import type { HomeValueEstimateResponse } from "@/lib/homeValue/types";

type Props = {
  result: HomeValueEstimateResponse;
  onContinue: () => void;
  onBack: () => void;
};

export default function PreviewStep({ result, onContinue, onBack }: Props) {
  const { estimate, confidence, market } = result;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">Your estimated range</h2>
        <p className="mt-2 text-sm text-gray-600">
          Here&apos;s a quick preview of your <span className="font-medium text-gray-800">estimated value</span> — not an
          appraisal or guaranteed offer.
        </p>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-gradient-to-b from-slate-50 to-white p-6 shadow-sm">
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Estimated value</p>
        <p className="mt-2 text-center text-4xl font-bold tabular-nums text-gray-900 sm:text-5xl">
          {formatEstimateCurrency(estimate.point)}
        </p>
        <p className="mt-2 text-center text-sm text-gray-600">
          Estimated range:{" "}
          <span className="font-semibold text-gray-900">
            {formatEstimateCurrency(estimate.low)} – {formatEstimateCurrency(estimate.high)}
          </span>
        </p>
        <div className="mx-auto mt-4 max-w-sm rounded-2xl bg-white/80 px-4 py-3 text-center text-sm text-gray-700 ring-1 ring-gray-200/80">
          <span className="font-medium text-gray-900">Confidence:</span> {confidence.level} (score{" "}
          {Math.round(confidence.score)}/100)
          <p className="mt-1 text-xs text-gray-500">{confidence.explanation}</p>
        </div>
        {market.city && market.city !== "Unknown" ? (
          <p className="mt-4 text-center text-xs text-gray-500">
            Market context: {market.city}, {market.state} · trend: {market.trend}
          </p>
        ) : null}
      </div>

      <p className="rounded-xl border border-amber-100 bg-amber-50/80 px-4 py-3 text-xs leading-relaxed text-amber-950">
        {HOME_VALUE_DISCLAIMER_SHORT}
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800"
        >
          See full breakdown
        </button>
      </div>
    </div>
  );
}
