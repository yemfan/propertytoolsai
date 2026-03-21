import type { RecommendationProperty } from "@/lib/propertyData";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function marketTrendMock(location: string): number {
  // Deterministic 0.95-1.1 multiplier by location hash.
  const s = location.toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  const v = Math.abs(h % 16) / 100;
  return 0.95 + v;
}

export function calculateDealScore(
  property: RecommendationProperty,
  subjectProperty: RecommendationProperty
): number {
  const subjectPpsf = subjectProperty.price / Math.max(1, subjectProperty.sqft);
  const ppsf = property.price / Math.max(1, property.sqft);

  const priceDiffPct = ((subjectProperty.price - property.price) / Math.max(1, subjectProperty.price)) * 100;
  const ppsfDiffPct = ((subjectPpsf - ppsf) / Math.max(1, subjectPpsf)) * 100;

  const market = marketTrendMock(property.location);
  const trendScore = clamp((market - 0.95) * 666, 0, 100); // 0..100

  const bedPenalty = Math.abs(property.beds - subjectProperty.beds) * 8;
  const bathPenalty = Math.abs(property.baths - subjectProperty.baths) * 6;
  const sqftPenalty = Math.abs(property.sqft - subjectProperty.sqft) / Math.max(1, subjectProperty.sqft) * 40;
  const featureScore = clamp(100 - bedPenalty - bathPenalty - sqftPenalty, 0, 100);

  const raw =
    clamp(priceDiffPct * 2 + 50, 0, 100) * 0.35 +
    clamp(ppsfDiffPct * 2 + 50, 0, 100) * 0.35 +
    trendScore * 0.15 +
    featureScore * 0.15;

  return clamp(Math.round(raw), 0, 100);
}
