/**
 * Pure estimate engine — baseline PPSF × sqft with multiplicative adjustments.
 */

import type {
  AdjustmentLine,
  HomeValueEstimateOutput,
  PropertyCondition,
  RenovationLevel,
} from "./types";

const DEFAULT_SQFT = 1650;
const DEFAULT_BEDS = 3;
const DEFAULT_BATHS = 2;

export type EstimateEngineInput = {
  baselinePpsf: number;
  sqft: number;
  beds: number;
  baths: number;
  propertyType: string;
  yearBuilt: number | null;
  lotSqft: number | null;
  condition: PropertyCondition;
  renovation: RenovationLevel;
  marketTrend: "up" | "down" | "stable";
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function propertyTypeMultiplier(type: string): { m: number; label: string } {
  const t = type.toLowerCase();
  if (/condo|apartment|coop/.test(t)) return { m: 0.92, label: "Condo / apartment adjustment" };
  if (/town|row/.test(t)) return { m: 0.97, label: "Townhome adjustment" };
  if (/multi|duplex|triplex|fourplex/.test(t)) return { m: 1.05, label: "Multi-unit adjustment" };
  return { m: 1, label: "Single-family baseline" };
}

function bedBathMultiplier(beds: number, baths: number): { m: number; label: string } {
  const b = clamp(beds, 1, 8);
  const ba = clamp(baths, 1, 8);
  // Typical 3/2 = 1.0; scale gently
  const bedPart = 1 + (b - DEFAULT_BEDS) * 0.025;
  const bathPart = 1 + (ba - DEFAULT_BATHS) * 0.035;
  const m = clamp(bedPart * bathPart, 0.88, 1.12);
  return { m, label: `Beds/baths vs typical (${DEFAULT_BEDS}bd/${DEFAULT_BATHS}ba)` };
}

function ageMultiplier(yearBuilt: number | null): { m: number; label: string } {
  if (yearBuilt == null || !Number.isFinite(yearBuilt)) {
    return { m: 0.98, label: "Age unknown (conservative)" };
  }
  const y = new Date().getFullYear();
  const age = clamp(y - yearBuilt, 0, 120);
  // Newer = slight premium up to 15 yrs, then gradual discount
  let m = 1;
  if (age <= 5) m = 1.04;
  else if (age <= 15) m = 1.02;
  else if (age <= 30) m = 1;
  else if (age <= 50) m = 0.97;
  else m = 0.93;
  return { m, label: `Age (${yearBuilt}, ~${age} yrs)` };
}

function lotMultiplier(sqft: number, lotSqft: number | null): { m: number; label: string } {
  if (lotSqft == null || !Number.isFinite(lotSqft) || lotSqft <= 0 || sqft <= 0) {
    return { m: 1, label: "Lot size (not specified)" };
  }
  const ratio = lotSqft / sqft;
  // Typical suburban ~3–5×; very high lot ratio nudges up for SFH demand
  let m = 1;
  if (ratio >= 8) m = 1.04;
  else if (ratio >= 5) m = 1.025;
  else if (ratio >= 3) m = 1.01;
  else if (ratio < 1.5) m = 0.985;
  return { m, label: "Lot / footprint ratio" };
}

/**
 * House condition multipliers on the adjusted baseline (between fair 0.97 and good 1.0).
 */
export const HOUSE_CONDITION_MULTIPLIER: Record<PropertyCondition, number> = {
  poor: 0.94,
  fair: 0.97,
  average: 0.985,
  good: 1.0,
  excellent: 1.05,
};

function conditionMultiplier(c: PropertyCondition): { m: number; label: string } {
  const key = (c ?? "good") as PropertyCondition;
  const m = HOUSE_CONDITION_MULTIPLIER[key] ?? HOUSE_CONDITION_MULTIPLIER.good;
  return { m, label: `Condition (${key})` };
}

function renovationMultiplier(r: RenovationLevel): { m: number; label: string } {
  const map: Record<RenovationLevel, number> = {
    none: 1,
    cosmetic: 1.01,
    major: 1.035,
    full: 1.055,
  };
  return { m: map[r], label: `Renovation (${r})` };
}

function trendMultiplier(t: "up" | "down" | "stable"): { m: number; label: string } {
  if (t === "up") return { m: 1.02, label: "Local market trend (rising)" };
  if (t === "down") return { m: 0.98, label: "Local market trend (softening)" };
  return { m: 1, label: "Local market trend (stable)" };
}

/**
 * Compute point value and range band (bandPct e.g. 0.06 = ±6%).
 */
export function computeHomeValueEstimate(
  input: EstimateEngineInput,
  rangeBandPct: number
): HomeValueEstimateOutput {
  const sqft = input.sqft > 0 ? input.sqft : DEFAULT_SQFT;

  const lines: AdjustmentLine[] = [];
  const push = (key: string, label: string, m: number) => {
    lines.push({ key, label, multiplier: m });
  };

  const t1 = propertyTypeMultiplier(input.propertyType);
  push("type", t1.label, t1.m);
  const t2 = bedBathMultiplier(input.beds, input.baths);
  push("bedbath", t2.label, t2.m);
  const t3 = ageMultiplier(input.yearBuilt);
  push("age", t3.label, t3.m);
  const t4 = lotMultiplier(sqft, input.lotSqft);
  push("lot", t4.label, t4.m);
  const t5 = conditionMultiplier(input.condition);
  push("condition", t5.label, t5.m);
  const t6 = renovationMultiplier(input.renovation);
  push("reno", t6.label, t6.m);
  const t7 = trendMultiplier(input.marketTrend);
  push("trend", t7.label, t7.m);

  const combined = lines.reduce((acc, x) => acc * x.multiplier, 1);
  const baseline = input.baselinePpsf * sqft;
  const point = Math.round(baseline * combined);
  const band = clamp(rangeBandPct, 0.03, 0.15);
  const low = Math.round(point * (1 - band));
  const high = Math.round(point * (1 + band));

  const summary = `Estimated value near $${point.toLocaleString()} (range about $${low.toLocaleString()}–$${high.toLocaleString()}) using ~$${Math.round(
    input.baselinePpsf
  )}/sqft baseline and your property details.`;

  return {
    point,
    low,
    high,
    baselinePpsf: input.baselinePpsf,
    adjustments: lines,
    summary,
  };
}

export { DEFAULT_SQFT, DEFAULT_BEDS, DEFAULT_BATHS };
