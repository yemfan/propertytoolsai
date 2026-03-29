/**
 * When to show lead capture for Home Value — preview stays free; gate detailed report.
 */
import type { HomeValueEstimateResponse } from "@/lib/homeValue/types";

/** Preview estimate is always allowed — this marks a “useful” estimate worth nudging toward capture. */
export function isUsefulHomeValueEstimate(result: HomeValueEstimateResponse | null): boolean {
  if (!result?.estimate?.point || result.estimate.point <= 0) return false;
  const score = result.confidence?.score ?? 0;
  const priced = result.comps?.pricedCount ?? 0;
  const level = result.confidence?.level;
  return (
    score >= 55 ||
    priced >= 1 ||
    level === "medium" ||
    level === "high"
  );
}
