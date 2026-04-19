/**
 * Confidence engine — weighted blend of address quality, detail completeness,
 * comp coverage, and market stability. Optional: data freshness feeds market stability.
 */

import type {
  ConfidenceInputsSnapshot,
  ConfidenceLevel,
  ConfidenceOutput,
  NormalizedProperty,
} from "./types";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** Canonical weighted model (each dimension 0–100). */
export type ConfidenceInputs = {
  addressQuality: number;
  detailCompleteness: number;
  compCoverage: number;
  marketStability: number;
};

const W_ADDR = 0.15;
const W_DETAIL = 0.35;
const W_COMP = 0.35;
const W_MARKET = 0.15;

/**
 * confidenceScore =
 *   (addressQuality × 0.15) + (detailCompleteness × 0.35) + (compCoverage × 0.35) + (marketStability × 0.15)
 */
export function computeConfidenceScoreFromInputs(inputs: ConfidenceInputs): number {
  const raw =
    clamp(inputs.addressQuality, 0, 100) * W_ADDR +
    clamp(inputs.detailCompleteness, 0, 100) * W_DETAIL +
    clamp(inputs.compCoverage, 0, 100) * W_COMP +
    clamp(inputs.marketStability, 0, 100) * W_MARKET;
  return clamp(Math.round(raw), 0, 100);
}

/** 80–100 = High, 55–79 = Medium, 0–54 = Low */
export function confidenceLevelFromScore(score: number): ConfidenceLevel {
  const s = clamp(score, 0, 100);
  if (s >= 80) return "high";
  if (s >= 55) return "medium";
  return "low";
}

// --- Derive 0–100 sub-scores from pipeline signals ---

const KEY_FIELD_COUNT = 6;

/** Map geocoding / parsing quality to 0–100. */
export function scoreAddressQualityFromSignals(
  addressQuality: "structured" | "partial" | "unknown"
): number {
  if (addressQuality === "structured") return 95;
  if (addressQuality === "partial") return 68;
  return 40;
}

/** From normalized property missing-field list (detail completeness / missing feature count). */
export function scoreDetailCompletenessFromProperty(property: NormalizedProperty): number {
  const missing = property.missingFields?.length ?? 0;
  const cappedMissing = Math.min(missing, KEY_FIELD_COUNT);
  return Math.round(100 * (1 - cappedMissing / KEY_FIELD_COUNT));
}

export function missingFeatureCount(property: NormalizedProperty): number {
  return property.missingFields?.length ?? 0;
}

/** Comp density: priced comps used for PPSF. */
export function scoreCompCoverageFromCounts(pricedCompCount: number): number {
  if (pricedCompCount >= 8) return 98;
  if (pricedCompCount >= 5) return 85;
  if (pricedCompCount >= 3) return 72;
  if (pricedCompCount >= 1) return 55;
  return 28;
}

export type MarketStabilitySignals = {
  marketTrend: "up" | "down" | "stable";
  daysOnMarket: number | null;
  /** When recent city/market data was available (higher = fresher). 0–100 */
  dataFreshness: number;
};

/**
 * Market stability + data freshness. Trend + DOM + freshness of market stats.
 */
export function scoreMarketStabilityFromSignals(s: MarketStabilitySignals): number {
  let base = 72;
  if (s.marketTrend === "stable") base = 86;
  else if (s.marketTrend === "up") base = 76;
  else base = 68;

  const dom = s.daysOnMarket;
  if (dom != null && dom > 0) {
    if (dom <= 30) base += 7;
    else if (dom >= 60) base -= 8;
  }

  // Blend in data freshness (e.g. cache age) — weighted lightly into this pillar
  const blended = base * 0.85 + clamp(s.dataFreshness, 0, 100) * 0.15;
  return clamp(Math.round(blended), 0, 100);
}

/**
 * Map city-data fetch age to 0–100 freshness (maxAgeHours window from caller).
 */
export function scoreDataFreshnessFromAgeHours(ageHours: number | null | undefined): number {
  if (ageHours == null || !Number.isFinite(ageHours)) return 70;
  if (ageHours <= 6) return 100;
  if (ageHours <= 24) return 90;
  if (ageHours <= 72) return 78;
  if (ageHours <= 168) return 62;
  return 45;
}

function buildConfidenceExplanation(
  level: ConfidenceLevel,
  inputs: ConfidenceInputs,
  missingCount: number
): string {
  const dq = inputs.detailCompleteness < 58;
  const cq = inputs.compCoverage >= 55;
  const aq = inputs.addressQuality < 55;
  const mq = inputs.marketStability < 55;

  if (level === "medium" && dq && cq) {
    return "Confidence is medium because we found enough local market data, but some property details are missing.";
  }
  if (level === "high" && missingCount === 0 && cq) {
    return "Confidence is high because the address is well resolved, property details are complete, and we have solid comparable sales.";
  }
  if (aq) {
    return `Confidence is ${level} because the address could not be fully verified; add a complete street address and ZIP for a tighter estimate.`;
  }
  if (!cq) {
    return `Confidence is ${level} because fewer comparable sales were available in this area; results lean more on broader market medians.`;
  }
  if (mq) {
    return `Confidence is ${level} because local market conditions are shifting or less data is available for this neighborhood.`;
  }
  if (dq) {
    return `Confidence is ${level} because some property details are still missing — refine beds, baths, and sqft when you can.`;
  }
  return `Confidence is ${level} based on address quality, detail completeness (${inputs.detailCompleteness}/100), comparable coverage (${inputs.compCoverage}/100), and market stability (${inputs.marketStability}/100).`;
}

// --- Legacy pipeline input (runEstimate) ---

export type ConfidenceInput = {
  property: NormalizedProperty;
  pricedCompCount: number;
  addressQuality: "structured" | "partial" | "unknown";
  marketTrend: "up" | "down" | "stable";
  daysOnMarket: number | null;
  /** Hours since city/market snapshot (optional — improves data freshness). */
  marketDataAgeHours?: number | null;
  /**
   * Count of available micro-market signals (walk score, flood zone,
   * school rating). Each available signal adds confidence because the
   * estimate is informed by more data dimensions. Range: 0–3.
   */
  microMarketSignalCount?: number;
};

/** Weighted contribution of each pillar to the final 0–100 score (impact ≈ pillar × weight). */
function factorsFromInputs(inputs: ConfidenceInputs): ConfidenceOutput["factors"] {
  return [
    {
      key: "address",
      label: `Address precision (${inputs.addressQuality}/100)`,
      impact: Math.round(inputs.addressQuality * W_ADDR),
    },
    {
      key: "detail",
      label: `Property details (${inputs.detailCompleteness}/100)`,
      impact: Math.round(inputs.detailCompleteness * W_DETAIL),
    },
    {
      key: "comps",
      label: `Comp density (${inputs.compCoverage}/100)`,
      impact: Math.round(inputs.compCoverage * W_COMP),
    },
    {
      key: "market",
      label: `Market stability (${inputs.marketStability}/100)`,
      impact: Math.round(inputs.marketStability * W_MARKET),
    },
  ];
}

/**
 * Full confidence + range band for estimate engine.
 */
export function computeConfidence(
  input: ConfidenceInput
): { confidence: ConfidenceOutput; rangeBandPct: number } {
  const addressQuality = scoreAddressQualityFromSignals(input.addressQuality);
  let detailCompleteness = scoreDetailCompletenessFromProperty(input.property);
  // Boost detail completeness when micro-market signals are available.
  // Each signal (walk score, flood zone, school rating) adds +3 points
  // because the estimate draws on more data dimensions.
  const microBonus = clamp((input.microMarketSignalCount ?? 0) * 3, 0, 9);
  detailCompleteness = clamp(detailCompleteness + microBonus, 0, 100);
  const compCoverage = scoreCompCoverageFromCounts(input.pricedCompCount);
  const dataFreshness = scoreDataFreshnessFromAgeHours(input.marketDataAgeHours ?? null);

  const marketStability = scoreMarketStabilityFromSignals({
    marketTrend: input.marketTrend,
    daysOnMarket: input.daysOnMarket,
    dataFreshness,
  });

  const confidenceInputs: ConfidenceInputs = {
    addressQuality,
    detailCompleteness,
    compCoverage,
    marketStability,
  };

  const score = computeConfidenceScoreFromInputs(confidenceInputs);
  const level = confidenceLevelFromScore(score);
  const missingCount = missingFeatureCount(input.property);

  const bandPct = clamp(0.14 - score / 1000, 0.045, 0.12);

  const explanation = buildConfidenceExplanation(level, confidenceInputs, missingCount);

  const confidence: ConfidenceOutput = {
    level,
    score,
    bandPct,
    factors: factorsFromInputs(confidenceInputs),
    explanation,
    inputs: confidenceInputs,
  };

  return { confidence, rangeBandPct: bandPct };
}
