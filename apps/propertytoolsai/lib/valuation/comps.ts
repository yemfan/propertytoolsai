import type { ComparableSale, SubjectPropertyInput } from "./types";
import { avg, median } from "./math";

function monthsSince(dateStr: string) {
  const then = new Date(dateStr).getTime();
  const now = Date.now();
  return (now - then) / (1000 * 60 * 60 * 24 * 30);
}

function similarityScore(subject: SubjectPropertyInput, comp: ComparableSale) {
  let score = 100;

  if (subject.propertyType && comp.propertyType && subject.propertyType !== comp.propertyType) score -= 20;
  if (subject.sqft && comp.sqft) score -= Math.min(Math.abs(subject.sqft - comp.sqft) / 50, 20);
  if (subject.beds && comp.beds) score -= Math.min(Math.abs(subject.beds - comp.beds) * 5, 15);
  if (subject.baths && comp.baths) score -= Math.min(Math.abs(subject.baths - comp.baths) * 4, 12);
  if (typeof comp.distanceMiles === "number") score -= Math.min(comp.distanceMiles * 10, 20);
  score -= Math.min(monthsSince(comp.soldDate) * 2, 15);

  return Math.max(1, score);
}

export function selectComparableSales(subject: SubjectPropertyInput, comps: ComparableSale[]) {
  const filtered = comps.filter((comp) => {
    if (!comp.soldPrice || !comp.sqft) return false;
    if (subject.propertyType && comp.propertyType && comp.propertyType !== subject.propertyType) return false;
    if (typeof comp.distanceMiles === "number" && comp.distanceMiles > 3) return false;
    if (monthsSince(comp.soldDate) > 12) return false;
    return true;
  });

  const sorted = filtered
    .map((comp) => ({
      comp,
      score: similarityScore(subject, comp),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return sorted;
}

export function buildCompsEstimate(subject: SubjectPropertyInput, comps: ComparableSale[]) {
  const selected = selectComparableSales(subject, comps);
  const pricePerSqftRows = selected
    .map(({ comp, score }) => ({
      ppsf: comp.pricePerSqft || (comp.sqft ? comp.soldPrice / comp.sqft : 0),
      weight: score,
      distanceMiles: comp.distanceMiles ?? null,
    }))
    .filter((x) => x.ppsf > 0);

  if (!subject.sqft || !pricePerSqftRows.length) {
    return {
      estimate: null as number | null,
      weightedPpsf: null as number | null,
      comparableCount: selected.length,
      avgDistanceMiles: null as number | null,
      selected: selected.map((x) => x.comp),
      soldMedianPpsf: null as number | null,
    };
  }

  const totalWeight = pricePerSqftRows.reduce((sum, x) => sum + x.weight, 0);
  const weightedPpsf =
    pricePerSqftRows.reduce((sum, x) => sum + x.ppsf * x.weight, 0) / Math.max(totalWeight, 1);

  const distValues = pricePerSqftRows
    .map((x) => (typeof x.distanceMiles === "number" ? x.distanceMiles : null))
    .filter((x): x is number => x != null && x >= 0);
  const avgDistanceMiles = distValues.length ? avg(distValues) : null;

  return {
    estimate: weightedPpsf * subject.sqft,
    weightedPpsf,
    comparableCount: selected.length,
    avgDistanceMiles,
    selected: selected.map((x) => x.comp),
    soldMedianPpsf: median(pricePerSqftRows.map((x) => x.ppsf)),
  };
}

export type CompsEstimateModel = ReturnType<typeof buildCompsEstimate>;
