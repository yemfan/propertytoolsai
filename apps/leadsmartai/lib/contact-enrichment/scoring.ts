import { calculateContactCompletenessScore } from "./normalize";
import type { LeadLike } from "./types";

/** Human-readable bucket for CRM dashboards (0–100 completeness). */
export function completenessTier(score: number): "weak" | "fair" | "strong" {
  if (score >= 75) return "strong";
  if (score >= 45) return "fair";
  return "weak";
}

export function leadCompleteness(lead: LeadLike): number {
  return calculateContactCompletenessScore(lead);
}
