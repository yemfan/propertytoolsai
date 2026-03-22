/**
 * Engagement score (0–100) for Home Value leads — combines estimate confidence,
 * property detail completeness, comp signal, and funnel depth for LeadSmart routing.
 */

import type { UserIntent } from "./types";

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
 * Weighted blend — tuned for lead routing, not underwriting.
 */
export function computeHomeValueEngagementScore(input: EngagementInputs): number {
  const { confidenceScore, fieldsCompleteRatio, pricedCompCount, hasEstimate, requestedFullReport, hasPhone } =
    input;

  let score = 0;

  // Confidence & data quality (max ~42)
  score += Math.round(confidenceScore * 0.28);
  score += Math.round(Math.max(0, Math.min(1, fieldsCompleteRatio)) * 22);

  // Market signal (max ~12)
  score += Math.min(12, pricedCompCount * 3);

  // Funnel depth (max ~28)
  if (hasEstimate) score += 10;
  if (requestedFullReport) score += 15;
  if (hasPhone) score += 3;

  // Intent clarity (max ~6) — explicit chip selection
  score += 6;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Map UI intent to CRM `intent` column (buy/sell/refinance) + preserve full label in metadata */
export function crmIntentFromLikelyIntent(likely: UserIntent): "buy" | "sell" | "refinance" {
  if (likely === "buyer") return "buy";
  if (likely === "investor") return "sell"; // investors often sell or acquire; CRM uses sell as default bucket
  return "sell";
}
