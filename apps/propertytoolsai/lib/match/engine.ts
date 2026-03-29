import type { BuyerPreferences, MatchableListing, PropertyMatch } from "./types";

function normCity(c?: string) {
  return c?.trim().toLowerCase() ?? "";
}

export function calculateMatchScore(prefs: BuyerPreferences, property: MatchableListing): PropertyMatch {
  let score = 0;
  const reasons: string[] = [];

  const price = Number(property.price);
  const budget = Number(prefs.budget);
  const priceDiff = Math.abs(price - budget);
  const priceScore = Math.max(0, 30 - priceDiff / 10000);
  score += priceScore;
  if (priceScore > 20) reasons.push("Close to your target budget");
  if (price <= budget * 1.02) reasons.push("At or below your budget");

  if (prefs.beds != null && prefs.beds > 0 && (property.beds ?? 0) >= prefs.beds) {
    score += 15;
    reasons.push("Bedroom count fits");
  }

  if (prefs.baths != null && prefs.baths > 0 && (property.baths ?? 0) >= prefs.baths) {
    score += 10;
    reasons.push("Bathroom count fits");
  }

  if (prefs.city && normCity(property.city) === normCity(prefs.city)) {
    score += 20;
    reasons.push("In your preferred city");
  }

  if (prefs.lifestyle === "investment") {
    if (typeof property.rentEstimate === "number" && property.rentEstimate > 0) {
      score += 10;
      reasons.push("Rental estimate available");
    } else if ((property.propertyType ?? "").toLowerCase().includes("multi")) {
      score += 8;
      reasons.push("Multi-unit / investment profile");
    } else if (typeof property.daysOnMarket === "number" && property.daysOnMarket >= 21) {
      score += 5;
      reasons.push("Longer time on market — possible negotiation room");
    }
  }

  if (prefs.lifestyle === "family") {
    const sq = property.sqft ?? 0;
    if ((property.beds ?? 0) >= 3 && sq >= 1400) {
      score += 12;
      reasons.push("Spacious layout for a household");
    } else if ((property.beds ?? 0) >= 3) {
      score += 6;
      reasons.push("Bedroom count supports a family");
    }
  }

  if (prefs.lifestyle === "luxury") {
    const sq = property.sqft ?? 0;
    if (sq >= 2200 || price >= budget * 0.92) {
      score += 10;
      reasons.push("Upscale size or price positioning");
    }
  }

  if (prefs.lifestyle === "commute") {
    const sq = property.sqft ?? 0;
    const type = (property.propertyType ?? "").toLowerCase();
    if (type.includes("condo") || sq <= 1600) {
      score += 8;
      reasons.push("Compact urban-style home");
    }
  }

  if (prefs.timeline === "asap") {
    const dom = property.daysOnMarket;
    if (typeof dom === "number" && dom <= 14) {
      score += 5;
      reasons.push("Fresh listing — good for an ASAP move");
    }
  }

  return {
    id: property.id,
    address: property.address,
    price: property.price,
    beds: property.beds,
    baths: property.baths,
    sqft: property.sqft,
    matchScore: Math.min(100, Math.round(score)),
    matchReasons: reasons,
  };
}
