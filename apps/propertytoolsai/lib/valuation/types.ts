export type SubjectPropertyInput = {
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  lat?: number;
  lng?: number;
  propertyType?: "single_family" | "condo" | "townhome" | "multi_family";
  beds?: number;
  baths?: number;
  sqft?: number;
  lotSize?: number;
  yearBuilt?: number;
  condition?: "poor" | "average" | "good" | "renovated";
  remodeledYear?: number;
};

export type ComparableSale = {
  id: string;
  address: string;
  soldPrice: number;
  soldDate: string;
  /** When present (e.g. from Rentcast), used for warehouse `zip_code` on ingest. */
  zip?: string;
  beds?: number;
  baths?: number;
  sqft?: number;
  yearBuilt?: number;
  distanceMiles?: number;
  propertyType?: string;
  pricePerSqft?: number;
};

export type ActiveListing = {
  id: string;
  address: string;
  listPrice: number;
  listDate?: string;
  beds?: number;
  baths?: number;
  sqft?: number;
  pricePerSqft?: number;
};

export type ValuationDataBundle = {
  apiEstimate?: number | null;
  /** From property record: lastSalePrice * (currentAssessed / assessedAtSale). */
  taxAnchorEstimate?: number | null;
  comps: ComparableSale[];
  activeListings: ActiveListing[];
  /**
   * Enriched subject property details from the upstream data
   * source (e.g., Rentcast /v1/properties). When present, the
   * pipeline uses these instead of defaults for sqft, beds, baths,
   * yearBuilt, and propertyType.
   */
  subjectDetails?: {
    sqft?: number;
    beds?: number;
    baths?: number;
    yearBuilt?: number;
    lotSize?: number;
    propertyType?: string;
    lastSalePrice?: number;
    lastSaleDate?: string;
  };
};

export type ValuationFactor = {
  label: string;
  impact: "positive" | "negative" | "neutral";
  value?: string | number | null;
  note: string;
};

export type ValuationResult = {
  finalEstimate: number;
  lowEstimate: number;
  highEstimate: number;
  confidenceScore: number;
  confidenceLabel: "high" | "medium" | "low";
  comparableCount: number;
  weightedPpsf?: number | null;
  apiEstimate?: number | null;
  compsEstimate?: number | null;
  /**
   * Dedicated “tax anchor” value for ML features.
   * Nullable until we define the real tax-anchor formula and populate it at valuation time.
   */
  taxAnchorEstimate?: number | null;
  listingTrendAdjustmentPct: number;
  conditionAdjustmentPct: number;
  rangeSpreadPct: number;
  /** Scenario used for calibration weights (stored as tier_used for analytics). */
  calibrationScenarioKey?: string;
  factors: ValuationFactor[];
  compsUsed: ComparableSale[];
  warnings: string[];
};
