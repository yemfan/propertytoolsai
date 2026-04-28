/**
 * Pure eligibility logic for "should we send a review request for
 * this transaction right now?"
 *
 * The cron loop calls this for each closed transaction. Returns
 * either { eligible: true } or { eligible: false, reason } so the
 * cron can log skips without ambiguity.
 *
 * Decision tree:
 *   1. Transaction must be closed
 *   2. Closed within the lookback window (don't ask 18 months
 *      later — the client moved on)
 *   3. Cooldown since closing — give them a few days to enjoy the
 *      keys before we email asking for a review
 *   4. Not already requested for this transaction
 *
 * Lookback default 90 days; cooldown default 7 days. Both
 * parameterizable so the cron's defaults are obvious from caller.
 */

export type ReviewEligibilityInput = {
  transaction: {
    id: string;
    status: string;
    closingDateActual: string | null;
  };
  /** True iff a review_requests row already exists for this transaction. */
  alreadyRequested: boolean;
  /** Now, in ISO. Pass-through for tests. */
  nowIso: string;
  /** Days since close before we ask (default 7). */
  cooldownDays?: number;
  /** Max days since close to still consider eligible (default 90). */
  lookbackDays?: number;
};

export type ReviewEligibility =
  | { eligible: true }
  | { eligible: false; reason: ReviewSkipReason };

export type ReviewSkipReason =
  | "not_closed"
  | "missing_close_date"
  | "too_recent"
  | "too_old"
  | "already_requested";

export function isEligibleForReviewRequest(
  input: ReviewEligibilityInput,
): ReviewEligibility {
  if (input.transaction.status !== "closed") {
    return { eligible: false, reason: "not_closed" };
  }
  if (!input.transaction.closingDateActual) {
    return { eligible: false, reason: "missing_close_date" };
  }

  const closedMs = Date.parse(input.transaction.closingDateActual);
  const nowMs = Date.parse(input.nowIso);
  if (!Number.isFinite(closedMs) || !Number.isFinite(nowMs)) {
    return { eligible: false, reason: "missing_close_date" };
  }

  const cooldownMs = clampDays(input.cooldownDays, 7) * 86_400_000;
  const lookbackMs = clampDays(input.lookbackDays, 90) * 86_400_000;
  const elapsed = nowMs - closedMs;

  if (elapsed < cooldownMs) {
    return { eligible: false, reason: "too_recent" };
  }
  if (elapsed > lookbackMs) {
    return { eligible: false, reason: "too_old" };
  }
  if (input.alreadyRequested) {
    return { eligible: false, reason: "already_requested" };
  }
  return { eligible: true };
}

function clampDays(input: number | undefined, fallback: number): number {
  if (input == null || !Number.isFinite(input)) return fallback;
  return Math.max(0, Math.round(input));
}
