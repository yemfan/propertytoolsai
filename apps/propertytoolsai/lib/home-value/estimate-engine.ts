/**
 * SEO / funnel-facing estimate engine — pure math + breakdown.
 * Server-side “full” estimates use {@link runHomeValueEstimatePipeline} (comps, city data, persistence).
 *
 * This module is suitable for documentation, tests, and optional client-side previews
 * when you already have a baseline $/sqft and property facts.
 */
import {
  computeHomeValueEstimate,
  type EstimateEngineInput as CoreEngineInput,
} from "@/lib/homeValue/estimateEngine";
import {
  computeConfidenceScoreFromInputs,
  confidenceLevelFromScore,
  scoreAddressQualityFromSignals,
  scoreCompCoverageFromCounts,
  scoreMarketStabilityFromSignals,
} from "@/lib/homeValue/confidenceEngine";
import type { PropertyCondition, RenovationLevel } from "@/lib/homeValue/types";

export type EstimateEngineBreakdownLine = {
  key: string;
  label: string;
  /** Multiplicative factor applied in sequence */
  multiplier: number;
  /** Human-readable effect */
  note: string;
};

export type EstimateEngineResult = {
  /** Point estimate (rounded) */
  estimate: number;
  low: number;
  high: number;
  baselinePpsf: number;
  /** 0–100 */
  confidenceScore: number;
  confidenceLevel: "high" | "medium" | "low";
  breakdown: EstimateEngineBreakdownLine[];
};

export type EstimateEngineParams = {
  /** Area baseline $/sqft (from market stats or comp median) */
  baselinePpsf: number;
  sqft: number;
  beds: number;
  baths: number;
  propertyType: string;
  yearBuilt: number | null;
  lotSqft: number | null;
  condition: PropertyCondition;
  renovation: RenovationLevel;
  marketTrend: "up" | "down" | "stable";
  /** Width of low/high band as fraction of point (e.g. 0.08 = ±8%) */
  rangeBandPct?: number;
  /** Optional: blend baseline toward comp median $/sqft (0–1 weight on comps) */
  comparableMedianPpsf?: number | null;
  compBlendWeight?: number;
};

/**
 * Blend baseline $/sqft with comparable sales median when available.
 */
export function refineBaselinePpsfWithComps(
  baselinePpsf: number,
  comparableMedianPpsf: number | null,
  weight = 0.55
): number {
  if (
    comparableMedianPpsf == null ||
    !Number.isFinite(comparableMedianPpsf) ||
    comparableMedianPpsf <= 0 ||
    !Number.isFinite(baselinePpsf) ||
    baselinePpsf <= 0
  ) {
    return baselinePpsf;
  }
  const w = Math.min(1, Math.max(0, weight));
  return baselinePpsf * (1 - w) + comparableMedianPpsf * w;
}

/**
 * Pure estimate + confidence from inputs (no network).
 * Use {@link refineBaselinePpsfWithComps} first when you have comp median $/sqft.
 */
export function computeEstimateFromInputs(
  params: EstimateEngineParams,
  confidenceContext?: {
    addressQuality?: "structured" | "partial" | "unknown";
    pricedCompCount?: number;
  }
): EstimateEngineResult {
  const rangeBandPct = params.rangeBandPct ?? 0.08;
  let baseline = params.baselinePpsf;
  if (params.comparableMedianPpsf != null) {
    baseline = refineBaselinePpsfWithComps(
      baseline,
      params.comparableMedianPpsf,
      params.compBlendWeight ?? 0.55
    );
  }

  const core: CoreEngineInput = {
    baselinePpsf: baseline,
    sqft: params.sqft,
    beds: params.beds,
    baths: params.baths,
    propertyType: params.propertyType,
    yearBuilt: params.yearBuilt,
    lotSqft: params.lotSqft,
    condition: params.condition,
    renovation: params.renovation,
    marketTrend: params.marketTrend,
  };

  const out = computeHomeValueEstimate(core, rangeBandPct);

  const addrQ = confidenceContext?.addressQuality ?? "partial";
  const comps = confidenceContext?.pricedCompCount ?? 0;

  const detailFieldsPresent =
    (params.sqft > 0 ? 1 : 0) +
    (params.yearBuilt != null ? 1 : 0) +
    (params.lotSqft != null && params.lotSqft > 0 ? 1 : 0) +
    (params.propertyType ? 1 : 0) +
    (params.beds > 0 ? 1 : 0) +
    (params.baths > 0 ? 1 : 0);

  const addressQuality = scoreAddressQualityFromSignals(addrQ);
  const detailCompleteness = Math.round((detailFieldsPresent / 6) * 100);
  const compCoverage = scoreCompCoverageFromCounts(comps);
  const marketStability = scoreMarketStabilityFromSignals({
    marketTrend: params.marketTrend,
    daysOnMarket: null,
    dataFreshness: 70,
  });

  const confidenceScore = computeConfidenceScoreFromInputs({
    addressQuality,
    detailCompleteness,
    compCoverage,
    marketStability,
  });

  const breakdown: EstimateEngineBreakdownLine[] = out.adjustments.map((a) => ({
    key: a.key,
    label: a.label,
    multiplier: a.multiplier,
    note:
      a.multiplier >= 1
        ? `Adds ~${Math.round((a.multiplier - 1) * 100)}% vs baseline`
        : `Reduces ~${Math.round((1 - a.multiplier) * 100)}% vs baseline`,
  }));

  return {
    estimate: out.point,
    low: out.low,
    high: out.high,
    baselinePpsf: Math.round(baseline),
    confidenceScore,
    confidenceLevel: confidenceLevelFromScore(confidenceScore),
    breakdown,
  };
}
