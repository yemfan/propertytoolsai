"use client";

import {
  confidenceClasses,
  formatCurrency,
  type EstimateResponse,
  type EstimateUiState,
} from "@/lib/home-value/types";

type Props = {
  result: EstimateResponse | null;
  state: EstimateUiState;
};

export function EstimateCard({ result, state }: Props) {
  if (!result && state === "idle") return null;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-sm font-medium text-gray-500">Estimated Value</div>
          <div className="mt-2 text-4xl font-semibold tracking-tight text-gray-900 md:text-5xl">
            {result ? formatCurrency(result.estimate.value) : "Calculating..."}
          </div>
          <div className="mt-3 text-sm text-gray-500">
            Range:{" "}
            {result
              ? `${formatCurrency(result.estimate.rangeLow)} – ${formatCurrency(result.estimate.rangeHigh)}`
              : "—"}
          </div>
        </div>

        <div className="flex flex-col gap-3 md:items-end">
          <div
            className={[
              "inline-flex rounded-full border px-3 py-1 text-xs font-medium capitalize",
              confidenceClasses(result?.estimate.confidence),
            ].join(" ")}
          >
            Confidence: {result?.estimate.confidence ?? "—"}
          </div>

          <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
            {result?.supportingData?.compCount ?? 0} local data points •{" "}
            {result?.supportingData?.medianPpsf
              ? `${formatCurrency(result.supportingData.medianPpsf)}/sqft benchmark`
              : "benchmark pending"}
          </div>
        </div>
      </div>

      {result?.estimate?.summary ? (
        <p className="mt-6 text-sm leading-relaxed text-gray-700 md:text-base">{result.estimate.summary}</p>
      ) : null}
    </section>
  );
}
