/**
 * Home Value estimator UI state machine (derived from funnel flags).
 *
 * Flow (conceptual):
 * idle → address_selected → estimating → preview_ready → refining → refined_result_ready
 * → unlocking → report_unlocked → next_steps
 *
 * Product copy also refers to **report_locked** (Section 4 gate) — same phase as
 * `refined_result_ready` once refine inputs differ from the first-estimate baseline.
 */

export type EstimateUiState =
  | "idle"
  | "address_selected"
  | "estimating"
  | "preview_ready"
  | "refining"
  | "refined_result_ready"
  | "unlocking"
  | "report_unlocked"
  | "next_steps";

export type EstimateUiStateInput = {
  addressTrimmed: string;
  /** True when lat/lng or city+state+zip from Places */
  hasStructuredPlace: boolean;
  loading: boolean;
  refinePending: boolean;
  hasEstimate: boolean;
  userRefined: boolean;
  reportUnlocked: boolean;
  leadModalOpen: boolean;
  /** When unlocked, recommendations are present → `next_steps` */
  hasRecommendations?: boolean;
};

/** Section 4 “report gate” — teaser visible, full detail locked */
export function isReportGateVisible(state: EstimateUiState): boolean {
  return state === "preview_ready" || state === "refined_result_ready" || state === "unlocking";
}

/**
 * Derives UI state from flags (priority order matters).
 */
export function deriveEstimateUiState(p: EstimateUiStateInput): EstimateUiState {
  if (p.leadModalOpen) return "unlocking";

  if (p.reportUnlocked) {
    if (p.hasRecommendations) return "next_steps";
    return "report_unlocked";
  }

  if (p.loading && !p.hasEstimate) return "estimating";
  if (p.loading && p.hasEstimate) return "refining";
  if (p.refinePending) return "refining";

  if (p.hasEstimate && !p.reportUnlocked && !p.refinePending && !p.loading) {
    if (p.userRefined) return "refined_result_ready";
    return "preview_ready";
  }

  if (p.addressTrimmed.length > 0 && (p.hasStructuredPlace || p.addressTrimmed.length >= 12)) {
    return "address_selected";
  }
  if (p.addressTrimmed.length > 0) return "address_selected";
  return "idle";
}

/** Human-readable for debugging / analytics. */
export function describeEstimateUiState(s: EstimateUiState): string {
  return s;
}
