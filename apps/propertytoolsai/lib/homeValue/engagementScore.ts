/**
 * Lead / engagement score for Home Value funnel — behavioral weights + banding for CRM.
 */

import type { UserIntent } from "./types";

/** Max estimate value ($) to count as “high value” for engagement. */
export const HIGH_VALUE_PROPERTY_THRESHOLD_USD = 750_000;

/** Suggested weights (raw max 110; stored score capped at 100). */
export const LEAD_SCORE_WEIGHTS = {
  homeValueToolUsed: 25,
  refinedDetailsSubmitted: 10,
  fullReportUnlocked: 15,
  phoneProvided: 10,
  repeatSession: 10,
  clickedCma: 15,
  clickedExpertCta: 10,
  highValueProperty: 15,
} as const;

export type LeadScoreBand = "low" | "medium" | "high";

/** 0–29 = low, 30–59 = medium, 60+ = high (uses capped 0–100 score). */
export function leadScoreBand(score: number): LeadScoreBand {
  const s = Math.max(0, Math.min(100, Math.round(Number(score))));
  if (s <= 29) return "low";
  if (s <= 59) return "medium";
  return "high";
}

export type EngagementScoreInput = {
  usedTool: boolean;
  refinedDetails: boolean;
  unlockedReport: boolean;
  phoneProvided: boolean;
  /** Returning visitor (e.g. hydrated session) or 2+ estimates in this funnel. */
  repeatSession: boolean;
  clickedCma: boolean;
  clickedExpert: boolean;
  highValueProperty: boolean;
};

/**
 * Weighted lead score (capped at 100). Same as product “lead scoring” table.
 */
export function computeEngagementScore(input: EngagementScoreInput): number {
  let score = 0;
  if (input.usedTool) score += LEAD_SCORE_WEIGHTS.homeValueToolUsed;
  if (input.refinedDetails) score += LEAD_SCORE_WEIGHTS.refinedDetailsSubmitted;
  if (input.unlockedReport) score += LEAD_SCORE_WEIGHTS.fullReportUnlocked;
  if (input.phoneProvided) score += LEAD_SCORE_WEIGHTS.phoneProvided;
  if (input.repeatSession) score += LEAD_SCORE_WEIGHTS.repeatSession;
  if (input.clickedCma) score += LEAD_SCORE_WEIGHTS.clickedCma;
  if (input.clickedExpert) score += LEAD_SCORE_WEIGHTS.clickedExpertCta;
  if (input.highValueProperty) score += LEAD_SCORE_WEIGHTS.highValueProperty;
  return Math.max(0, Math.min(100, score));
}

/** Alias — same inputs as {@link computeEngagementScore}. */
export function computeLeadScore(input: EngagementScoreInput): number {
  return computeEngagementScore(input);
}

export type EngagementInputs = {
  /** Model confidence 0–100 */
  confidenceScore: number;
  /** Fraction of key fields present (from normalizedProperty) */
  fieldsCompleteRatio: number;
  /** Priced comparable sales used in baseline */
  pricedCompCount: number;
  /** User ran at least one successful estimate */
  hasEstimate: boolean;
  /** User opened the unlock / lead modal (strong signal) */
  requestedFullReport: boolean;
  /** Phone provided on lead form */
  hasPhone?: boolean;
  /** Declared intent (seller / buyer / investor) */
  likelyIntent: UserIntent;
};

/**
 * Legacy weighted blend — kept for callers that only have model signals (not click flags).
 */
export function computeHomeValueEngagementScore(input: EngagementInputs): number {
  const { confidenceScore, fieldsCompleteRatio, pricedCompCount, hasEstimate, requestedFullReport, hasPhone } =
    input;

  let score = 0;

  score += Math.round(confidenceScore * 0.28);
  score += Math.round(Math.max(0, Math.min(1, fieldsCompleteRatio)) * 22);

  score += Math.min(12, pricedCompCount * 3);

  if (hasEstimate) score += 10;
  if (requestedFullReport) score += 15;
  if (hasPhone) score += 3;

  score += 6;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Map UI intent to CRM `intent` column (buy/sell/refinance) + preserve full label in metadata */
export function crmIntentFromLikelyIntent(likely: UserIntent): "buy" | "sell" | "refinance" {
  if (likely === "buyer") return "buy";
  if (likely === "investor") return "sell";
  return "sell";
}
