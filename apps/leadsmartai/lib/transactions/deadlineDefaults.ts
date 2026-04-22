/**
 * California buyer-rep default contingency deadlines, computed relative
 * to `mutual_acceptance_date`.
 *
 * Values match CAR RPA (California Residential Purchase Agreement)
 * defaults:
 *   * Inspection: 17 days
 *   * Appraisal: 17 days (same window — appraisal often races inspection)
 *   * Loan contingency: 21 days
 *   * Closing: 30 days (commonly negotiated; 21-45 is typical)
 *
 * When the agent sets or changes `mutual_acceptance_date`, the service
 * layer calls `applyDeadlineDefaults()` to fill any NULL deadline
 * columns. Non-NULL values are preserved — the agent may have
 * negotiated a non-standard period and we don't want to silently clobber
 * that.
 */

export const CA_BUYER_REP_DEFAULT_OFFSETS = {
  inspection_deadline: 17,
  appraisal_deadline: 17,
  loan_contingency_deadline: 21,
  closing_date: 30,
} as const;

/**
 * Add `days` to an ISO date string (YYYY-MM-DD), returning a new ISO
 * date string. Uses UTC arithmetic to avoid DST edge cases — a date
 * column has no time-zone anyway.
 */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

type DeadlineFields = {
  mutual_acceptance_date: string | null;
  inspection_deadline: string | null;
  appraisal_deadline: string | null;
  loan_contingency_deadline: string | null;
  closing_date: string | null;
};

/**
 * Returns a patch containing default-filled deadlines for any fields
 * that are currently NULL. Caller merges the patch into the record.
 *
 * Never overwrites existing non-NULL deadlines. If
 * `mutual_acceptance_date` is NULL, returns an empty patch — we have no
 * anchor to compute from.
 */
export function applyDeadlineDefaults(input: DeadlineFields): Partial<DeadlineFields> {
  const anchor = input.mutual_acceptance_date;
  if (!anchor) return {};

  const patch: Partial<DeadlineFields> = {};
  if (!input.inspection_deadline) {
    patch.inspection_deadline = addDaysIso(anchor, CA_BUYER_REP_DEFAULT_OFFSETS.inspection_deadline);
  }
  if (!input.appraisal_deadline) {
    patch.appraisal_deadline = addDaysIso(anchor, CA_BUYER_REP_DEFAULT_OFFSETS.appraisal_deadline);
  }
  if (!input.loan_contingency_deadline) {
    patch.loan_contingency_deadline = addDaysIso(anchor, CA_BUYER_REP_DEFAULT_OFFSETS.loan_contingency_deadline);
  }
  if (!input.closing_date) {
    patch.closing_date = addDaysIso(anchor, CA_BUYER_REP_DEFAULT_OFFSETS.closing_date);
  }
  return patch;
}
