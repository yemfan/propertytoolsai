/**
 * Home Value Estimate — shared types for API + client.
 */

export type PropertyCondition = "poor" | "fair" | "average" | "good" | "excellent";
export type RenovationLevel = "none" | "cosmetic" | "major" | "full";
export type UserIntent = "seller" | "buyer" | "investor";

/** Normalized property for estimation (warehouse + user overrides). Alias: structured address + facts. */
export type NormalizedProperty = {
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lotSqft: number | null;
  yearBuilt: number | null;
  propertyType: string | null;
  /** Fields we wanted but could not fill from enrichment */
  missingFields: string[];
};

/** Alias — autocomplete + enrichment output for API consumers */
export type NormalizedAddress = NormalizedProperty;

export type AdjustmentLine = {
  key: string;
  label: string;
  multiplier: number;
};

export type HomeValueEstimateOutput = {
  point: number;
  low: number;
  high: number;
  baselinePpsf: number;
  adjustments: AdjustmentLine[];
  summary: string;
};

export type ConfidenceLevel = "high" | "medium" | "low";

export type ConfidenceOutput = {
  level: ConfidenceLevel;
  /** 0–100 */
  score: number;
  bandPct: number;
  factors: { key: string; label: string; impact: number }[];
};

export type ToolkitRecommendation = {
  title: string;
  href: string;
  reason: string;
  intent: UserIntent;
};

/** Client → API payload */
export type HomeValueEstimateRequest = {
  address: string;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  lat?: number | null;
  lng?: number | null;
  /** User refinements (optional) */
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  lotSqft?: number | null;
  yearBuilt?: number | null;
  propertyType?: string | null;
  condition?: PropertyCondition;
  renovation?: RenovationLevel;
  /** Likely user intent for recommendations (client-only; optional on API) */
  intent?: UserIntent;
  /** Force refresh of property ingestion */
  refresh?: boolean;
  /** Client funnel id (sessionStorage); used to upsert `home_value_sessions`. */
  session_id?: string;
};

/** API → client */
export type HomeValueEstimateResponse = {
  ok: true;
  normalizedProperty: NormalizedProperty;
  estimate: HomeValueEstimateOutput;
  confidence: ConfidenceOutput;
  market: {
    city: string;
    state: string;
    trend: "up" | "down" | "stable";
    medianPrice: number | null;
    pricePerSqft: number | null;
    source: string;
  };
  comps: {
    pricedCount: number;
    totalConsidered: number;
  };
  recommendations: ToolkitRecommendation[];
  /** Echoed funnel id (server may assign if missing). */
  sessionId: string;
};
