export type ValuationTrackingLogInput = {
  leadId?: string | null;
  propertyAddress: string;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  propertyType?: string | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  lotSize?: number | null;
  yearBuilt?: number | null;
  condition?: string | null;
  remodeledYear?: number | null;
  apiEstimate?: number | null;
  compsEstimate?: number | null;
  /** Dedicated “tax anchor” value for ML features (nullable until formula is defined). */
  taxAnchorEstimate?: number | null;
  finalEstimate: number;
  lowEstimate: number;
  highEstimate: number;
  confidenceScore: number;
  confidenceLabel: "high" | "medium" | "low";
  comparableCount: number;
  weightedPpsf?: number | null;
  listingTrendAdjustmentPct: number;
  conditionAdjustmentPct: number;
  rangeSpreadPct: number;
  tierUsed?: string | null;
  factors: unknown[];
  warnings: string[];
  valuationVersion?: string;
  source?: string | null;
};

export type ValuationSaleAttachInput = {
  valuationRunId: string;
  actualSalePrice: number;
  actualSaleDate?: string | null;
};

export type ValuationAccuracySummary = {
  totalTrackedSales: number;
  medianErrorPct: number;
  avgErrorPct: number;
  withinRangePct: number;
  highConfidenceMedianErrorPct: number;
  mediumConfidenceMedianErrorPct: number;
  lowConfidenceMedianErrorPct: number;
};

/** Row shape for {@link buildAccuracySummary} (subset of `valuation_runs`). */
export type ValuationAccuracyRow = {
  confidence_label: string;
  error_pct: number | null;
  inside_range: boolean | null;
};

export type ValuationOutlierRow = {
  id: string;
  property_address: string;
  city: string | null;
  state: string | null;
  final_estimate: number;
  actual_sale_price: number;
  error_pct: number | null;
  confidence_label: string;
  comparable_count: number;
  tier_used: string | null;
  created_at: string;
};
