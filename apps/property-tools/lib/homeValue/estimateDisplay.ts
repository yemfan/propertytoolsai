/**
 * Trust & compliance: avoid false precision; label outputs as estimates, not appraisals.
 */

/** Round to nearest $1,000 for display (avoids “$1,243,287” false precision). */
export function formatEstimateCurrency(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "--";
  const rounded = Math.round(value / 1000) * 1000;
  return `$${rounded.toLocaleString()}`;
}

export const HOME_VALUE_DISCLAIMER_SHORT =
  "This is an automated estimate for informational purposes only. It is not an appraisal or a professional opinion of value.";

export const HOME_VALUE_DISCLAIMER_RANGE =
  "We show a value range because market data and property details affect uncertainty.";

export function compSupportLabel(pricedCount: number, totalConsidered: number): string {
  if (pricedCount >= 5) return `${pricedCount} comparable sales with sale prices contributed to this estimate.`;
  if (pricedCount >= 1)
    return `${pricedCount} nearby sale${pricedCount === 1 ? "" : "s"} with prices were used; other signals fill gaps when comps are thin.`;
  if (totalConsidered > 0)
    return "Few priced comparable sales were available; this estimate leans more on broader market medians — treat the range cautiously.";
  return "Comparable sale coverage is limited; use this band as a starting point, not a guarantee.";
}
