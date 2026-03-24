"use client";

import { useHomeValueEstimate } from "@/lib/home-value/useHomeValueEstimate";
import HomeValueTrustDisclaimer from "@/components/home-value/HomeValueTrustDisclaimer";
import { AddressInput } from "./AddressInput";
import { EstimateCard } from "./EstimateCard";
import { FullReport } from "./FullReport";
import { NextSteps } from "./NextSteps";
import { RefinementForm } from "./RefinementForm";
import { ReportGate } from "./ReportGate";

export function HomeValueEstimateExperience() {
  const hv = useHomeValueEstimate();
  const {
    address,
    setAddress,
    submitAddress,
    refinements,
    setRefinements,
    result,
    status,
    errorMessage,
    unlockError,
    reportUnlocked,
    derived,
    retry,
    openReportGate,
    unlockReport,
    reset,
  } = hv;

  const estimating = status === "estimating";
  const gateExpanded = status === "report_locked" || status === "unlocking";
  const showResults = Boolean(result && derived.showPreview);
  const refreshOverlay = estimating && Boolean(result);

  return (
    <div className="min-h-screen bg-slate-50">
      <section className="relative overflow-hidden border-b border-slate-200/80 bg-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-30%,rgba(0,114,206,0.14),transparent)]" />
        <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-14 md:px-6 md:pb-20 md:pt-20">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.25em] text-[#0072ce]">
            PropertyToolsAI
          </p>
          <h1 className="mx-auto mt-4 max-w-3xl text-center text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl lg:text-[2.75rem] lg:leading-tight">
            Know what your home is worth — before you list or refinance
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-center text-base text-slate-600 md:text-lg">
            Instant estimated range powered by local comps and your property details. Refine beds, baths, condition, and
            more — then unlock the full breakdown when you&apos;re ready.
          </p>

          <div className="mx-auto mt-10 max-w-3xl">
            <AddressInput
              value={address}
              onChange={setAddress}
              onSubmit={submitAddress}
              disabled={estimating && !result}
              error={derived.addressError}
            />
          </div>

          {status === "error" && errorMessage ? (
            <div className="mx-auto mt-6 max-w-3xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <p>{errorMessage}</p>
              <button
                type="button"
                onClick={retry}
                className="mt-2 text-sm font-semibold text-red-900 underline-offset-2 hover:underline"
              >
                Try again
              </button>
            </div>
          ) : null}

          {estimating && !result ? (
            <div className="mx-auto mt-12 flex max-w-md flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-12 shadow-sm">
              <span className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-[#0072ce]" />
              <p className="text-center text-sm font-medium text-slate-700">Analyzing comps and market signals…</p>
              <p className="text-center text-xs text-slate-500">Usually takes just a few seconds.</p>
            </div>
          ) : null}
        </div>
      </section>

      {showResults && result ? (
        <section className="mx-auto max-w-5xl space-y-10 px-4 py-12 md:px-6 md:py-16">
          <EstimateCard result={result} isRefreshing={refreshOverlay} />

          <RefinementForm value={refinements} onChange={setRefinements} disabled={estimating} />

          <HomeValueTrustDisclaimer className="mx-auto max-w-3xl" />

          {!reportUnlocked ? (
            <ReportGate
              expanded={gateExpanded}
              onRequestOpen={openReportGate}
              submitting={status === "unlocking"}
              error={unlockError}
              onSubmit={async (input) => {
                const out = await unlockReport(input);
                return { ok: out.ok, error: "error" in out ? out.error : undefined };
              }}
            />
          ) : (
            <>
              <FullReport result={result} />
              <NextSteps recommendations={result.recommendations} />
            </>
          )}

          <div className="flex justify-center pb-8">
            <button
              type="button"
              onClick={reset}
              className="text-sm font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
            >
              Start over with a new address
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
