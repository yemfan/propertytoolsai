export type ComparableHome = {
  id: string;
  address: string;
  soldPrice: number;
  soldDate: string;
  pricePerSqft?: number;
  sqft?: number;
  beds?: number;
  baths?: number;
  distanceMiles: number;
  similarityScore: number;
  matchReasons?: string[];
  lat?: number;
  lng?: number;
};

/**
 * Stable React key + selection id when {@link ComparableHome.id} is missing or empty from the API.
 */
export function comparableHomeKey(comp: ComparableHome, index: number): string {
  const id = String(comp.id ?? "").trim();
  if (id) return id;
  return `comp-${index}`;
}

export type SubjectHome = {
  address: string;
  lat: number;
  lng: number;
  sqft?: number;
  estimateValue: number;
  rangeLow: number;
  rangeHigh: number;
  confidence: "low" | "medium" | "high";
  confidenceScore: number;
  medianPpsf: number;
  weightedPpsf?: number;
  summary?: string;
  adjustments?: Record<string, number>;
};

/** USD whole dollars; `0` / non-finite / missing → em dash (comps should not show $0 for unknown sale price). */
export function money(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value === 0) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function fmtDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function confidenceClass(confidence: SubjectHome["confidence"]) {
  switch (confidence) {
    case "high":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "medium":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "low":
      return "bg-red-50 text-red-700 border-red-200";
  }
}

export function normalizeAdjustments(adjustments?: Record<string, number>) {
  if (!adjustments) return [];
  const labels: Record<string, string> = {
    bedsAdjustment: "Bedrooms",
    bathsAdjustment: "Bathrooms",
    sqftAdjustment: "Square footage",
    lotSizeAdjustment: "Lot size",
    yearBuiltAdjustment: "Year built",
    conditionAdjustment: "Condition",
    renovationAdjustment: "Renovation",
    marketRecencyAdjustment: "Market recency",
    totalAdjustment: "Total adjustment",
    // Engine multiplier-derived keys
    typeAdjustment: "Property type",
    bedbathAdjustment: "Beds & baths",
    ageAdjustment: "Property age",
    lotAdjustment: "Lot size",
    renoAdjustment: "Renovation",
    trendAdjustment: "Market trend",
    walkScoreAdjustment: "Walk Score",
    floodZoneAdjustment: "Flood zone",
    seasonalAdjustment: "Seasonal market",
    schoolRatingAdjustment: "School district",
  };

  return Object.entries(adjustments)
    .filter(([key]) => key !== "totalAdjustment")
    .filter(([, value]) => typeof value === "number" && Math.abs(value) >= 1000)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .map(([key, value]) => ({
      key,
      label: labels[key] || key,
      value,
    }));
}
