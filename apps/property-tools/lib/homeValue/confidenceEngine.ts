/**
 * Confidence score from data completeness, comps, address quality, market stability.
 */

import type { ConfidenceLevel, ConfidenceOutput, NormalizedProperty } from "./types";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export type ConfidenceInput = {
  property: NormalizedProperty;
  /** 0+ sold comps used in PPSF */
  pricedCompCount: number;
  /** Google / structured address */
  addressQuality: "structured" | "partial" | "unknown";
  /** City market trend volatility proxy */
  marketTrend: "up" | "down" | "stable";
  /** median DOM from city data — higher = less stable signal */
  daysOnMarket: number | null;
};

/**
 * bandPct: half-width around point estimate for range display.
 */
export function computeConfidence(
  input: ConfidenceInput
): { confidence: ConfidenceOutput; rangeBandPct: number } {
  const factors: ConfidenceOutput["factors"] = [];
  let score = 55;

  // Address
  if (input.addressQuality === "structured") {
    score += 12;
    factors.push({ key: "addr", label: "Structured address (Places)", impact: 12 });
  } else if (input.addressQuality === "partial") {
    score += 5;
    factors.push({ key: "addr", label: "Partial address parsing", impact: 5 });
  } else {
    factors.push({ key: "addr", label: "Limited address validation", impact: -5 });
    score -= 5;
  }

  // Field completeness
  const p = input.property;
  const fields = [
    p.sqft != null && p.sqft > 0,
    p.beds != null,
    p.baths != null,
    p.yearBuilt != null,
    p.lotSqft != null && p.lotSqft > 0,
    p.propertyType != null && p.propertyType.length > 0,
  ];
  const complete = fields.filter(Boolean).length / fields.length;
  score += Math.round(complete * 18);
  factors.push({
    key: "complete",
    label: `Property fields (${Math.round(complete * 100)}% complete)`,
    impact: Math.round(complete * 18),
  });

  // Comps
  if (input.pricedCompCount >= 6) {
    score += 15;
    factors.push({ key: "comps", label: "Strong comparable coverage", impact: 15 });
  } else if (input.pricedCompCount >= 3) {
    score += 10;
    factors.push({ key: "comps", label: "Moderate comparable coverage", impact: 10 });
  } else if (input.pricedCompCount >= 1) {
    score += 4;
    factors.push({ key: "comps", label: "Limited comparable sales", impact: 4 });
  } else {
    score -= 8;
    factors.push({ key: "comps", label: "No recent comp-based PPSF (market fallback)", impact: -8 });
  }

  // Market stability (DOM)
  const dom = input.daysOnMarket;
  if (dom != null && dom > 0) {
    if (dom <= 30) {
      score += 4;
      factors.push({ key: "dom", label: "Fast-moving market (lower DOM)", impact: 4 });
    } else if (dom >= 60) {
      score -= 4;
      factors.push({ key: "dom", label: "Slower market (higher DOM)", impact: -4 });
    }
  }

  if (input.marketTrend === "stable") {
    score += 3;
    factors.push({ key: "trend", label: "Stable local trend", impact: 3 });
  } else {
    factors.push({ key: "trend", label: "Active market shift (wider band)", impact: -2 });
    score -= 2;
  }

  score = clamp(Math.round(score), 18, 96);

  let level: ConfidenceLevel = "medium";
  if (score >= 72) level = "high";
  else if (score < 45) level = "low";

  // Map score → range width: higher confidence = tighter band
  const bandPct = clamp(0.14 - score / 1000, 0.045, 0.12);

  const confidence: ConfidenceOutput = {
    level,
    score,
    bandPct,
    factors,
  };

  return { confidence, rangeBandPct: bandPct };
}
