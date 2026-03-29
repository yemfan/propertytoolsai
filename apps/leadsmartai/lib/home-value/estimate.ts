// lib/home-value/estimate.ts

export type PropertyType =
  | "single_family"
  | "condo"
  | "townhome"
  | "multi_family";

export type PropertyCondition = "poor" | "fair" | "good" | "excellent";

export type LikelyIntent = "seller" | "buyer" | "investor" | "unknown";
export type ConfidenceLabel = "low" | "medium" | "high";

export interface EstimateInput {
  address: {
    fullAddress: string;
    city: string;
    state: string;
    zip: string;
  };
  details: {
    propertyType?: PropertyType;
    beds?: number;
    baths?: number;
    sqft?: number;
    yearBuilt?: number;
    lotSize?: number;
    condition?: PropertyCondition;
    renovatedRecently?: boolean;
  };
  market: {
    medianPpsf: number;
    medianPrice?: number;
    yoyTrendPct?: number; // e.g. 0.042 = 4.2%
    avgDaysOnMarket?: number;
    compCount?: number;
    typicalBeds?: number;
    typicalBaths?: number;
    typicalLotSize?: number;
    marketVolatilityScore?: number; // 0-100, higher = more stable
  };
  context?: {
    likelyIntent?: LikelyIntent;
    source?: string;
  };
}

export interface EstimateFactors {
  basePpsf: number;
  baselineEstimate: number;
  bedAdjustment: number;
  bathAdjustment: number;
  ageAdjustment: number;
  lotAdjustment: number;
  conditionAdjustment: number;
  renovationAdjustment: number;
  trendAdjustment: number;
  totalAdjustment: number;
  compCount: number;
  yoyTrendPct: number;
}

export interface EstimateResult {
  property: {
    fullAddress: string;
    city: string;
    state: string;
    zip: string;
    propertyType?: PropertyType;
    beds?: number;
    baths?: number;
    sqft?: number;
    yearBuilt?: number;
    lotSize?: number;
    condition?: PropertyCondition;
    renovatedRecently?: boolean;
  };
  estimate: {
    value: number;
    rangeLow: number;
    rangeHigh: number;
    confidence: ConfidenceLabel;
    confidenceScore: number;
    summary: string;
  };
  supportingData: {
    medianPpsf: number;
    medianPrice?: number;
    yoyTrendPct: number;
    compCount: number;
    avgDaysOnMarket?: number;
  };
  factors: EstimateFactors;
  recommendations: string[];
}

const CURRENT_YEAR = new Date().getFullYear();

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundCurrency(value: number): number {
  return Math.round(value / 1000) * 1000;
}

function safeNumber(value: number | undefined, fallback = 0): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function getConditionMultiplier(condition?: PropertyCondition): number {
  switch (condition) {
    case "poor":
      return 0.94;
    case "fair":
      return 0.97;
    case "good":
      return 1.0;
    case "excellent":
      return 1.05;
    default:
      return 1.0;
  }
}

function getPropertyTypeMultiplier(propertyType?: PropertyType): number {
  switch (propertyType) {
    case "condo":
      return 0.96;
    case "townhome":
      return 0.98;
    case "multi_family":
      return 1.03;
    case "single_family":
    default:
      return 1.0;
  }
}

function calculateDetailCompleteness(input: EstimateInput): number {
  const fields: Array<unknown> = [
    input.details.propertyType,
    input.details.beds,
    input.details.baths,
    input.details.sqft,
    input.details.yearBuilt,
    input.details.lotSize,
    input.details.condition,
  ];

  const present = fields.filter(
    (v) => v !== undefined && v !== null && v !== ""
  ).length;

  return Math.round((present / fields.length) * 100);
}

function calculateAddressQuality(input: EstimateInput): number {
  const { fullAddress, city, state, zip } = input.address;
  let score = 0;

  if (fullAddress?.trim()) score += 40;
  if (city?.trim()) score += 20;
  if (state?.trim()) score += 20;
  if (zip?.trim()) score += 20;

  return clamp(score, 0, 100);
}

function calculateCompCoverage(compCount?: number): number {
  const count = safeNumber(compCount);
  if (count >= 10) return 100;
  if (count >= 7) return 85;
  if (count >= 4) return 65;
  if (count >= 2) return 45;
  if (count >= 1) return 25;
  return 10;
}

function calculateMarketStability(input: EstimateInput): number {
  const explicit = input.market.marketVolatilityScore;
  if (explicit !== undefined) return clamp(explicit, 0, 100);

  const trend = Math.abs(safeNumber(input.market.yoyTrendPct));
  // more extreme trend = less stable
  if (trend <= 0.03) return 85;
  if (trend <= 0.06) return 70;
  if (trend <= 0.1) return 55;
  return 40;
}

function calculateConfidenceScore(input: EstimateInput): number {
  const addressQuality = calculateAddressQuality(input);
  const detailCompleteness = calculateDetailCompleteness(input);
  const compCoverage = calculateCompCoverage(input.market.compCount);
  const marketStability = calculateMarketStability(input);

  const score =
    addressQuality * 0.15 +
    detailCompleteness * 0.35 +
    compCoverage * 0.35 +
    marketStability * 0.15;

  return Math.round(clamp(score, 0, 100));
}

function getConfidenceLabel(score: number): ConfidenceLabel {
  if (score >= 80) return "high";
  if (score >= 55) return "medium";
  return "low";
}

function getRangeSpread(confidenceScore: number): number {
  if (confidenceScore >= 80) return 0.04;
  if (confidenceScore >= 55) return 0.07;
  return 0.12;
}

function calculateAgeAdjustment(
  estimateBase: number,
  yearBuilt?: number
): number {
  if (!yearBuilt || yearBuilt < 1800 || yearBuilt > CURRENT_YEAR) return 0;

  const age = CURRENT_YEAR - yearBuilt;

  if (age <= 10) return estimateBase * 0.03;
  if (age <= 25) return estimateBase * 0.015;
  if (age <= 45) return 0;
  if (age <= 70) return estimateBase * -0.02;
  return estimateBase * -0.04;
}

function calculateLotAdjustment(
  estimateBase: number,
  lotSize?: number,
  typicalLotSize?: number
): number {
  if (!lotSize || !typicalLotSize || typicalLotSize <= 0) return 0;

  const ratio = lotSize / typicalLotSize;

  if (ratio >= 1.4) return estimateBase * 0.025;
  if (ratio >= 1.15) return estimateBase * 0.01;
  if (ratio <= 0.75) return estimateBase * -0.02;
  if (ratio <= 0.9) return estimateBase * -0.01;

  return 0;
}

function calculateBedroomAdjustment(
  estimateBase: number,
  beds?: number,
  typicalBeds?: number
): number {
  if (beds === undefined || typicalBeds === undefined) return 0;

  const delta = beds - typicalBeds;
  return delta * (estimateBase * 0.012);
}

function calculateBathroomAdjustment(
  estimateBase: number,
  baths?: number,
  typicalBaths?: number
): number {
  if (baths === undefined || typicalBaths === undefined) return 0;

  const delta = baths - typicalBaths;
  return delta * (estimateBase * 0.018);
}

function buildSummary(params: {
  address: string;
  value: number;
  rangeLow: number;
  rangeHigh: number;
  confidence: ConfidenceLabel;
  trendPct: number;
  compCount: number;
}): string {
  const trendText =
    params.trendPct > 0
      ? "The local market trend is supportive of the estimate."
      : params.trendPct < 0
        ? "Recent local softness slightly tempers the estimate."
        : "The estimate is based mostly on current local pricing levels.";

  const compText =
    params.compCount >= 7
      ? "We found strong local market coverage."
      : params.compCount >= 3
        ? "We found a moderate amount of nearby market data."
        : "Nearby market data is limited, so the range is wider.";

  return `${params.address} is estimated at about $${params.value.toLocaleString()}, with a likely range of $${params.rangeLow.toLocaleString()} to $${params.rangeHigh.toLocaleString()}. Confidence is ${params.confidence}. ${trendText} ${compText}`;
}

function getRecommendations(intent?: LikelyIntent): string[] {
  switch (intent) {
    case "seller":
      return [
        "Get a detailed CMA report",
        "Compare your home with recent local sales",
        "Talk to a local listing expert",
      ];
    case "buyer":
      return [
        "Estimate mortgage affordability for this property",
        "Compare this home with similar nearby options",
        "See AI-recommended alternatives",
      ];
    case "investor":
      return [
        "Estimate rental income",
        "Analyze ROI and cash flow",
        "Use AI Property Comparison to rank deal quality",
      ];
    default:
      return [
        "Get a detailed valuation report",
        "Compare this property with similar homes",
        "Explore the next best tool for your goals",
      ];
  }
}

/**
 * Main production-ready estimate function
 */
export function calculateHomeValueEstimate(
  input: EstimateInput
): EstimateResult {
  const sqft = safeNumber(input.details.sqft);
  const medianPpsf = safeNumber(input.market.medianPpsf);
  const yoyTrendPct = safeNumber(input.market.yoyTrendPct);
  const compCount = safeNumber(input.market.compCount);

  if (!input.address.fullAddress || !input.address.city || !input.address.state) {
    throw new Error("Address is incomplete.");
  }

  if (!sqft || sqft <= 0) {
    throw new Error("Square footage is required for the current estimate model.");
  }

  if (!medianPpsf || medianPpsf <= 0) {
    throw new Error("Local market median price per sqft is required.");
  }

  const propertyTypeMultiplier = getPropertyTypeMultiplier(
    input.details.propertyType
  );

  const baselineEstimate = sqft * medianPpsf * propertyTypeMultiplier;

  const bedAdjustment = calculateBedroomAdjustment(
    baselineEstimate,
    input.details.beds,
    input.market.typicalBeds
  );

  const bathAdjustment = calculateBathroomAdjustment(
    baselineEstimate,
    input.details.baths,
    input.market.typicalBaths
  );

  const ageAdjustment = calculateAgeAdjustment(
    baselineEstimate,
    input.details.yearBuilt
  );

  const lotAdjustment = calculateLotAdjustment(
    baselineEstimate,
    input.details.lotSize,
    input.market.typicalLotSize
  );

  const conditionAdjustment =
    baselineEstimate * (getConditionMultiplier(input.details.condition) - 1);

  const renovationAdjustment = input.details.renovatedRecently
    ? baselineEstimate * 0.03
    : 0;

  const trendAdjustment = baselineEstimate * yoyTrendPct * 0.5;

  const totalAdjustment =
    bedAdjustment +
    bathAdjustment +
    ageAdjustment +
    lotAdjustment +
    conditionAdjustment +
    renovationAdjustment +
    trendAdjustment;

  const rawEstimate = baselineEstimate + totalAdjustment;
  const estimateValue = roundCurrency(Math.max(rawEstimate, 50000));

  const confidenceScore = calculateConfidenceScore(input);
  const confidence = getConfidenceLabel(confidenceScore);
  const spread = getRangeSpread(confidenceScore);

  const rangeLow = roundCurrency(estimateValue * (1 - spread));
  const rangeHigh = roundCurrency(estimateValue * (1 + spread));

  const summary = buildSummary({
    address: input.address.fullAddress,
    value: estimateValue,
    rangeLow,
    rangeHigh,
    confidence,
    trendPct: yoyTrendPct,
    compCount,
  });

  const factors: EstimateFactors = {
    basePpsf: medianPpsf,
    baselineEstimate: roundCurrency(baselineEstimate),
    bedAdjustment: roundCurrency(bedAdjustment),
    bathAdjustment: roundCurrency(bathAdjustment),
    ageAdjustment: roundCurrency(ageAdjustment),
    lotAdjustment: roundCurrency(lotAdjustment),
    conditionAdjustment: roundCurrency(conditionAdjustment),
    renovationAdjustment: roundCurrency(renovationAdjustment),
    trendAdjustment: roundCurrency(trendAdjustment),
    totalAdjustment: roundCurrency(totalAdjustment),
    compCount,
    yoyTrendPct,
  };

  return {
    property: {
      fullAddress: input.address.fullAddress,
      city: input.address.city,
      state: input.address.state,
      zip: input.address.zip,
      propertyType: input.details.propertyType,
      beds: input.details.beds,
      baths: input.details.baths,
      sqft: input.details.sqft,
      yearBuilt: input.details.yearBuilt,
      lotSize: input.details.lotSize,
      condition: input.details.condition,
      renovatedRecently: input.details.renovatedRecently,
    },
    estimate: {
      value: estimateValue,
      rangeLow,
      rangeHigh,
      confidence,
      confidenceScore,
      summary,
    },
    supportingData: {
      medianPpsf,
      medianPrice: input.market.medianPrice,
      yoyTrendPct,
      compCount,
      avgDaysOnMarket: input.market.avgDaysOnMarket,
    },
    factors,
    recommendations: getRecommendations(input.context?.likelyIntent),
  };
}
