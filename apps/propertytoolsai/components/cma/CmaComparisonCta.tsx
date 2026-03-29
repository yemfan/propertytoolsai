"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccess } from "@/components/AccessProvider";
import { trackEvent } from "@/lib/analyticsClient";
import { calculateDealScore } from "@/lib/dealScoring";
import { toRecommendationProperty } from "@/lib/propertyData";
import type { PropertyInput } from "@/lib/propertyScoring";
import {
  buildCmaSubjectProperty,
  generateMockAiPicks,
  saveComparisonPrefill,
} from "@/lib/cmaComparisonPrefill";

type CmaResponseShape = {
  subject: {
    address: string;
    beds: number;
    baths: number;
    sqft: number;
  };
  estimatedValue: number;
  comps: Array<{
    address: string;
    price: number;
    sqft: number;
    beds: number;
    baths: number;
  }>;
};

type Props = {
  data: CmaResponseShape;
};

type PreviewRow = {
  property: PropertyInput;
  dealScore: number;
};

type PreviewState = {
  subject: PropertyInput;
  rows: PreviewRow[];
  explanation: string;
};

function fmtMoney(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Aligned with `cma_completed` / `compare_clicked` on Smart CMA. */
const ANALYTICS = {
  AI_PICKS_PREVIEW_SHOWN: "cma_compare_ai_picks_preview_shown",
  AI_PICKS_CONTINUE: "cma_compare_ai_picks_continue",
} as const;

function AiPicksPreviewSkeleton() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading AI picks">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="h-4 w-40 rounded bg-slate-200" />
          <div className="h-3 w-56 max-w-full rounded bg-slate-100" />
        </div>
        <div className="h-3 w-14 rounded bg-slate-100" />
      </div>
      <ul className="mt-4 divide-y divide-slate-100">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex flex-wrap gap-3 py-3 first:pt-0">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3 w-24 rounded bg-slate-100" />
              <div className="h-7 w-16 rounded bg-emerald-100/80" />
              <div className="h-4 w-full max-w-md rounded bg-slate-200" />
              <div className="h-3 w-[80%] max-w-sm rounded bg-slate-100" />
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/50 p-4">
        <div className="h-3 w-28 rounded bg-blue-100/80" />
        <div className="mt-3 space-y-2">
          <div className="h-3 w-full rounded bg-slate-100" />
          <div className="h-3 w-full rounded bg-slate-100" />
          <div className="h-3 w-4/5 rounded bg-slate-100" />
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <div className="h-11 min-w-[200px] flex-1 rounded-xl bg-slate-200" />
        <div className="h-11 w-32 rounded-xl bg-slate-100" />
      </div>
    </div>
  );
}

export default function CmaComparisonCta({ data }: Props) {
  const router = useRouter();
  const { tier, openPaywall } = useAccess();
  const premium = tier === "premium";
  const [loadingAiPicks, setLoadingAiPicks] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const previewPanelRef = useRef<HTMLDivElement | null>(null);

  /**
   * On small viewports, scroll the preview panel into view when loading starts (skeleton) or when
   * results replace the skeleton. Skip during refresh so the page doesn’t jump.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    if (!mq.matches) return;
    if (loadingAiPicks && preview) return;
    if (!loadingAiPicks && !preview) return;
    const el = previewPanelRef.current;
    if (!el) return;
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => {
      el.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: "start",
      });
    });
  }, [preview, loadingAiPicks]);

  function buildMockPreview(subject: PropertyInput): PreviewState {
    const picks = generateMockAiPicks(data);
    const subjRec = toRecommendationProperty(subject, subject.address);
    const rows: PreviewRow[] = picks.map((p) => ({
      property: p,
      dealScore: calculateDealScore(toRecommendationProperty(p, subject.address), subjRec),
    }));
    rows.sort((a, b) => b.dealScore - a.dealScore);
    return {
      subject,
      rows: rows.slice(0, 3),
      explanation:
        "These alternatives are ranked using deal quality vs. your CMA subject (price, $/sqft, and feature fit). Add your own notes in the comparison tool next.",
    };
  }

  async function loadAiPicksPreview() {
    setError(null);
    void trackEvent("compare_clicked", {
      variant: "ai_picks",
      source: "smart_cma",
      address: data.subject.address,
    });

    const subject = buildCmaSubjectProperty(data);

    if (!premium) {
      openPaywall(
        "AI Picks adds similar listings to your comparison automatically. Upgrade to Premium to unlock AI Picks and multi-property compare."
      );
      return;
    }

    setLoadingAiPicks(true);
    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property: {
            address: subject.address,
            price: subject.price,
            beds: subject.beds,
            baths: subject.baths,
            sqft: subject.sqft,
            location: subject.address,
          },
          limit: 3,
        }),
      });
      const json = await res.json().catch(() => ({}));

      if (res.ok && json?.ok && Array.isArray(json?.recommended) && json.recommended.length > 0) {
        const rows: PreviewRow[] = json.recommended.slice(0, 3).map((row: { property: PropertyInput; dealScore: number }) => ({
          property: row.property,
          dealScore: Number(row.dealScore ?? 0),
        }));
        setPreview({
          subject,
          rows,
          explanation: String(json.explanation ?? "").trim() || "Review the ranked alternatives below.",
        });
        void trackEvent(ANALYTICS.AI_PICKS_PREVIEW_SHOWN, {
          source: "smart_cma",
          address: data.subject.address,
          count: rows.length,
        });
      } else {
        if (!res.ok) {
          setError(json?.error ?? "Could not load AI picks. Showing mock alternatives.");
        } else {
          setError("No recommendations returned. Showing mock alternatives.");
        }
        setPreview(buildMockPreview(subject));
        void trackEvent(ANALYTICS.AI_PICKS_PREVIEW_SHOWN, {
          source: "smart_cma",
          address: data.subject.address,
          count: 3,
          fallback: true,
        });
      }
    } catch {
      setError("Could not load AI picks. Showing mock alternatives.");
      setPreview(buildMockPreview(subject));
      void trackEvent(ANALYTICS.AI_PICKS_PREVIEW_SHOWN, {
        source: "smart_cma",
        address: data.subject.address,
        count: 3,
        fallback: true,
      });
    } finally {
      setLoadingAiPicks(false);
    }
  }

  function continueToComparison() {
    if (!preview) return;
    const picks = preview.rows.map((r) => r.property);
    void trackEvent(ANALYTICS.AI_PICKS_CONTINUE, {
      source: "smart_cma",
      address: data.subject.address,
      pick_count: picks.length,
    });
    saveComparisonPrefill({ rows: [preview.subject, ...picks] });
    router.push(`/ai-property-comparison?from=cma&ai_picks=1&t=${Date.now()}`);
  }

  function goToMyProperties() {
    setError(null);
    setPreview(null);
    void trackEvent("compare_clicked", {
      variant: "my_properties",
      source: "smart_cma",
      address: data.subject.address,
    });
    const subject = buildCmaSubjectProperty(data);
    saveComparisonPrefill({ rows: [subject] });
    router.push(`/ai-property-comparison?from=cma&t=${Date.now()}`);
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 via-white to-indigo-50/80 p-6 shadow-md sm:p-8">
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-blue-100/60 blur-2xl" aria-hidden />
      <div className="relative">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Next step</p>
        <h3 className="mt-2 text-xl font-bold text-slate-900 sm:text-2xl">
          Not sure if this is the best deal?
        </h3>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          Compare this home side-by-side with other options. Run an investment-style score and optional AI ranking
          to see how it stacks up.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={goToMyProperties}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 sm:min-w-[200px]"
          >
            Compare with My Properties
          </button>
          <button
            type="button"
            onClick={() => void loadAiPicksPreview()}
            disabled={loadingAiPicks}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border-2 border-indigo-200 bg-white px-6 py-3 text-sm font-semibold text-indigo-900 shadow-sm transition hover:bg-indigo-50 disabled:opacity-60 sm:min-w-[200px]"
          >
            {loadingAiPicks ? "Loading recommendations…" : "Compare with AI Picks"}
            {!premium ? (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                Premium
              </span>
            ) : null}
          </button>
        </div>
        {error ? <p className="mt-2 text-xs text-amber-700">{error}</p> : null}
        {!premium ? (
          <p className="mt-3 text-xs text-slate-500">
            AI Picks loads ranked alternatives and an AI summary before you open the comparison tool.{" "}
            <span className="font-medium text-slate-700">Premium</span> required.
          </p>
        ) : (
          <p className="mt-3 text-xs text-slate-500">
            AI Picks shows a quick preview (top 3 deal scores + AI explanation), then you can continue to the full
            comparison.
          </p>
        )}

        {loadingAiPicks || preview ? (
          <div
            ref={previewPanelRef}
            className="mt-8 scroll-mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:scroll-mt-8 sm:p-6"
          >
            {loadingAiPicks && !preview ? (
              <AiPicksPreviewSkeleton />
            ) : preview ? (
              <div className="relative">
                {loadingAiPicks ? (
                  <div
                    className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg bg-white/75 backdrop-blur-[1px]"
                    aria-live="polite"
                  >
                    <span className="text-sm font-semibold text-indigo-900">Refreshing picks…</span>
                  </div>
                ) : null}

                <div className={loadingAiPicks ? "pointer-events-none opacity-60" : undefined}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Recommended alternatives</h4>
                      <p className="mt-1 text-xs text-slate-500">
                        vs. your CMA subject ·{" "}
                        <span className="font-medium text-slate-700">{preview.subject.address}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPreview(null)}
                      disabled={loadingAiPicks}
                      className="text-xs font-semibold text-slate-700 underline hover:text-slate-900 disabled:opacity-50"
                    >
                      Dismiss
                    </button>
                  </div>

                  <ul className="mt-4 divide-y divide-slate-100">
                    {preview.rows.map((row, idx) => {
                      const pps =
                        row.property.sqft > 0 ? Math.round(row.property.price / row.property.sqft) : null;
                      return (
                        <li
                          key={row.property.id}
                          className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold uppercase text-slate-500">#{idx + 1} Deal score</p>
                            <p className="text-lg font-bold text-emerald-700">{row.dealScore}</p>
                            <p className="mt-1 text-sm font-medium text-slate-900">{row.property.address}</p>
                            <p className="text-xs text-slate-600">
                              {fmtMoney(row.property.price)} · {row.property.sqft.toLocaleString()} sqft ·{" "}
                              {row.property.beds} bd / {row.property.baths} ba
                              {pps != null ? ` · $${pps}/sqft` : ""}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/80 p-4">
                    <p className="text-xs font-semibold uppercase text-blue-800">AI explanation</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-800">{preview.explanation}</p>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={continueToComparison}
                      disabled={loadingAiPicks}
                      className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60 sm:min-w-[200px]"
                    >
                      Continue to AI Property Comparison
                    </button>
                    <button
                      type="button"
                      onClick={() => void loadAiPicksPreview()}
                      disabled={loadingAiPicks}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                    >
                      Refresh picks
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
