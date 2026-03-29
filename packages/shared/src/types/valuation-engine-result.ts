/**
 * Rich valuation / CMA engine output (`apps/propertytoolsai` / `lib/valuation`).
 * Distinct from {@link ValuationResult} in `valuation-result.ts`, which is a persisted CRM snapshot.
 */

export type ValuationEngineComparableSale = {
  id: string;
  address: string;
  soldPrice: number;
  soldDate: string;
  zip?: string;
  beds?: number;
  baths?: number;
  sqft?: number;
  yearBuilt?: number;
  distanceMiles?: number;
  propertyType?: string;
  pricePerSqft?: number;
};

export type ValuationEngineFactor = {
  label: string;
  impact: "positive" | "negative" | "neutral";
  value?: string | number | null;
  note: string;
};

export type ValuationEngineResult = {
  finalEstimate: number;
  lowEstimate: number;
  highEstimate: number;
  confidenceScore: number;
  confidenceLabel: "high" | "medium" | "low";
  comparableCount: number;
  weightedPpsf?: number | null;
  apiEstimate?: number | null;
  compsEstimate?: number | null;
  taxAnchorEstimate?: number | null;
  listingTrendAdjustmentPct: number;
  conditionAdjustmentPct: number;
  rangeSpreadPct: number;
  calibrationScenarioKey?: string;
  factors: ValuationEngineFactor[];
  compsUsed: ValuationEngineComparableSale[];
  warnings: string[];
};
