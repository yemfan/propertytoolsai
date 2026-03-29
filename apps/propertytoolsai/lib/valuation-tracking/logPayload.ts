import type { SubjectPropertyInput, ValuationResult } from "@/lib/valuation/types";
import type { ValuationTrackingLogInput } from "./types";

export function valuationResultToLogInput(
  subject: SubjectPropertyInput,
  result: ValuationResult,
  opts?: { leadId?: string | null; source?: string | null }
): ValuationTrackingLogInput {
  return {
    leadId: opts?.leadId ?? null,
    propertyAddress: subject.address,
    city: subject.city ?? null,
    state: subject.state ?? null,
    zip: subject.zip ?? null,
    propertyType: subject.propertyType ?? null,
    beds: subject.beds ?? null,
    baths: subject.baths ?? null,
    sqft: subject.sqft ?? null,
    lotSize: subject.lotSize ?? null,
    yearBuilt: subject.yearBuilt ?? null,
    condition: subject.condition ?? null,
    remodeledYear: subject.remodeledYear ?? null,
    apiEstimate: result.apiEstimate ?? null,
    compsEstimate: result.compsEstimate ?? null,
    taxAnchorEstimate: result.taxAnchorEstimate ?? null,
    finalEstimate: result.finalEstimate,
    lowEstimate: result.lowEstimate,
    highEstimate: result.highEstimate,
    confidenceScore: result.confidenceScore,
    confidenceLabel: result.confidenceLabel,
    comparableCount: result.comparableCount,
    weightedPpsf: result.weightedPpsf ?? null,
    listingTrendAdjustmentPct: result.listingTrendAdjustmentPct,
    conditionAdjustmentPct: result.conditionAdjustmentPct,
    rangeSpreadPct: result.rangeSpreadPct,
    tierUsed: result.calibrationScenarioKey ?? null,
    factors: result.factors,
    warnings: result.warnings,
    valuationVersion: "v2",
    source: opts?.source ?? "rentcast_valuation_engine",
  };
}
