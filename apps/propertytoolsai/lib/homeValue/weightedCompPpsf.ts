/**
 * Weighted comp PPSF calculator — weights comparable sales by
 * recency, similarity, and proximity instead of simple averaging.
 *
 * This produces a more accurate baseline PPSF by giving more weight
 * to comps that are recent, nearby, and similar in characteristics.
 */

import type { PropertyCompRow } from "@/lib/propertyService";

export type CompWeightInput = {
  soldPrice: number;
  sqft: number;
  soldDate: string | null;
  distanceMiles: number | null;
  beds: number | null;
  baths: number | null;
  yearBuilt: number | null;
};

export type WeightedCompResult = {
  weightedPpsf: number;
  totalWeight: number;
  compCount: number;
  /** Number of comps excluded as PPSF outliers (>OUTLIER_HIGH × median or <OUTLIER_LOW × median). */
  outliersDropped: number;
  /** Median PPSF used to detect outliers (undefined when <4 valid comps). */
  medianPpsf?: number;
};

/**
 * PPSF outlier thresholds — if a comp's sold price per sqft is less than
 * OUTLIER_LOW × median or greater than OUTLIER_HIGH × median of the valid
 * set, we drop it from the weighted average. Prevents a single tiny-condo
 * or mansion comp from skewing the estimate.
 */
const OUTLIER_LOW = 0.5;
const OUTLIER_HIGH = 1.75;
/** Need at least this many valid comps before outlier trimming engages. */
const MIN_COMPS_FOR_OUTLIER_TRIM = 4;

function medianOf(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Recency weight: sales within 90 days get full weight (1.0),
 * decaying to 0.3 for sales older than 12 months.
 */
function recencyWeight(soldDate: string | null): number {
  if (!soldDate) return 0.5; // unknown date gets neutral weight
  const daysAgo = (Date.now() - new Date(soldDate).getTime()) / (1000 * 60 * 60 * 24);
  if (daysAgo <= 90) return 1.0;
  if (daysAgo <= 180) return 0.85;
  if (daysAgo <= 270) return 0.65;
  if (daysAgo <= 365) return 0.45;
  return 0.3;
}

/**
 * Proximity weight: closer comps get higher weight.
 * Within 0.5 miles = 1.0, decays to 0.4 beyond 5 miles.
 */
function proximityWeight(distanceMiles: number | null): number {
  if (distanceMiles == null) return 0.5;
  if (distanceMiles <= 0.5) return 1.0;
  if (distanceMiles <= 1) return 0.9;
  if (distanceMiles <= 2) return 0.75;
  if (distanceMiles <= 3) return 0.6;
  if (distanceMiles <= 5) return 0.5;
  return 0.4;
}

/**
 * Similarity weight: how similar is this comp to the subject property.
 * Based on beds, baths, sqft delta, and age delta.
 */
function similarityWeight(
  comp: { beds: number | null; baths: number | null; sqft: number; yearBuilt: number | null },
  subject: { beds: number | null; baths: number | null; sqft: number | null; yearBuilt: number | null }
): number {
  let score = 1.0;

  // Bed count difference
  if (comp.beds != null && subject.beds != null) {
    const bedDiff = Math.abs(comp.beds - subject.beds);
    if (bedDiff === 0) score *= 1.0;
    else if (bedDiff === 1) score *= 0.9;
    else score *= 0.7;
  }

  // Bath count difference
  if (comp.baths != null && subject.baths != null) {
    const bathDiff = Math.abs(comp.baths - subject.baths);
    if (bathDiff === 0) score *= 1.0;
    else if (bathDiff <= 1) score *= 0.92;
    else score *= 0.75;
  }

  // Sqft difference (%)
  if (subject.sqft != null && subject.sqft > 0) {
    const pctDiff = Math.abs(comp.sqft - subject.sqft) / subject.sqft;
    if (pctDiff <= 0.1) score *= 1.0;
    else if (pctDiff <= 0.2) score *= 0.9;
    else if (pctDiff <= 0.35) score *= 0.75;
    else score *= 0.6;
  }

  // Age difference
  if (comp.yearBuilt != null && subject.yearBuilt != null) {
    const ageDiff = Math.abs(comp.yearBuilt - subject.yearBuilt);
    if (ageDiff <= 5) score *= 1.0;
    else if (ageDiff <= 15) score *= 0.92;
    else if (ageDiff <= 30) score *= 0.8;
    else score *= 0.65;
  }

  return Math.max(score, 0.2);
}

/**
 * Calculate weighted PPSF from warehouse comps.
 * Falls back to simple average if weighting fails.
 */
export function computeWeightedCompPpsf(
  comps: CompWeightInput[],
  subject: {
    beds: number | null;
    baths: number | null;
    sqft: number | null;
    yearBuilt: number | null;
  }
): WeightedCompResult | null {
  const valid = comps.filter(
    (c) => c.soldPrice > 0 && c.sqft > 0 && Number.isFinite(c.soldPrice / c.sqft)
  );

  if (valid.length === 0) return null;

  /**
   * Outlier trimming — compute the median PPSF across the valid set
   * and drop comps whose PPSF is outside [OUTLIER_LOW, OUTLIER_HIGH]
   * × median. This prevents a single tiny-condo or mansion comp from
   * dragging the estimate in either direction.
   *
   * Only engages when we have enough comps for the median to be
   * meaningful — below MIN_COMPS_FOR_OUTLIER_TRIM we keep everything
   * and rely on the weighting itself.
   */
  const allPpsf = valid.map((c) => c.soldPrice / c.sqft);
  const median = medianOf(allPpsf);
  const kept =
    valid.length >= MIN_COMPS_FOR_OUTLIER_TRIM && median > 0
      ? valid.filter((c) => {
          const p = c.soldPrice / c.sqft;
          return p >= median * OUTLIER_LOW && p <= median * OUTLIER_HIGH;
        })
      : valid;
  const outliersDropped = valid.length - kept.length;

  /**
   * Degenerate case: outlier trim dropped everything. Fall back to
   * the un-trimmed set so we still produce a number — but flag that
   * no outliers were removed.
   */
  const workingSet = kept.length > 0 ? kept : valid;

  let sumWeightedPpsf = 0;
  let sumWeights = 0;

  for (const comp of workingSet) {
    const ppsf = comp.soldPrice / comp.sqft;
    const wRecency = recencyWeight(comp.soldDate);
    const wProximity = proximityWeight(comp.distanceMiles);
    const wSimilarity = similarityWeight(
      { beds: comp.beds, baths: comp.baths, sqft: comp.sqft, yearBuilt: comp.yearBuilt },
      subject
    );

    // Combined weight = product of all three dimensions
    const weight = wRecency * wProximity * wSimilarity;
    sumWeightedPpsf += ppsf * weight;
    sumWeights += weight;
  }

  if (sumWeights === 0) return null;

  return {
    weightedPpsf: Math.round(sumWeightedPpsf / sumWeights),
    totalWeight: sumWeights,
    compCount: workingSet.length,
    outliersDropped: kept.length > 0 ? outliersDropped : 0,
    medianPpsf: valid.length >= MIN_COMPS_FOR_OUTLIER_TRIM ? Math.round(median) : undefined,
  };
}

/**
 * Convert warehouse PropertyCompRow[] to CompWeightInput[].
 */
export function warehouseCompsToWeightInput(
  comps: PropertyCompRow[]
): CompWeightInput[] {
  return comps
    .map((c) => {
      const sold = c.sold_price != null ? Number(c.sold_price) : 0;
      const sqft = c.comp_property?.sqft != null ? Number(c.comp_property.sqft) : 0;
      if (sold <= 0 || sqft <= 0) return null;
      return {
        soldPrice: sold,
        sqft,
        soldDate: c.sold_date ?? null,
        distanceMiles: c.distance_miles ?? null,
        beds: c.comp_property?.beds ?? null,
        baths: c.comp_property?.baths ?? null,
        yearBuilt: c.comp_property?.year_built ?? null,
      } satisfies CompWeightInput;
    })
    .filter(Boolean) as CompWeightInput[];
}
