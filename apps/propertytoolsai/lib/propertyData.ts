import type { PropertyInput } from "@/lib/propertyScoring";

export type RecommendationProperty = PropertyInput & {
  location: string;
  city: string;
  zip: string | null;
};

export function parseCityZip(location: string) {
  const clean = location.trim();
  const zipMatch = clean.match(/\b\d{5}(?:-\d{4})?\b/);
  const zip = zipMatch ? zipMatch[0].slice(0, 5) : null;
  const parts = clean.split(",").map((p) => p.trim()).filter(Boolean);
  const city = parts.length >= 2 ? parts[parts.length - 2] : parts[0] || "Local Area";
  return { city, zip };
}

function seededRand(seed: number) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * Mock similar-property retrieval.
 * Filters and synthesis follow same city/zip, +/-15% price, +/-1 bed/bath, +/-20% sqft.
 */
export async function fetchSimilarProperties(input: {
  address: string;
  location?: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
}): Promise<RecommendationProperty[]> {
  const location = (input.location || input.address || "").trim();
  const { city, zip } = parseCityZip(location);
  const basePrice = Math.max(1, input.price);
  const baseSqft = Math.max(1, input.sqft);

  const candidates: RecommendationProperty[] = [];
  for (let i = 0; i < 9; i++) {
    const r1 = seededRand(i + basePrice / 1000);
    const r2 = seededRand(i + baseSqft / 100);
    const price = Math.round(basePrice * (0.86 + r1 * 0.28)); // roughly +/-14%
    const sqft = Math.round(baseSqft * (0.82 + r2 * 0.36)); // roughly +/-18%
    const beds = Math.max(0, Math.round(input.beds + (r1 > 0.66 ? 1 : r1 < 0.33 ? -1 : 0)));
    const baths = Math.max(0, Math.round((input.baths + (r2 > 0.66 ? 1 : r2 < 0.33 ? -1 : 0)) * 2) / 2);
    const address = `${120 + i} ${city || "Main"} Ave, ${city}${zip ? `, ${zip}` : ""}`;
    candidates.push({
      id: `rec_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      address,
      location: `${city}${zip ? ` ${zip}` : ""}`.trim(),
      city,
      zip,
      price,
      beds,
      baths,
      sqft,
      rentMonthly: null,
    });
  }

  const priceMin = basePrice * 0.85;
  const priceMax = basePrice * 1.15;
  const sqftMin = baseSqft * 0.8;
  const sqftMax = baseSqft * 1.2;

  return candidates.filter((p) => {
    const samePlace = zip ? p.zip === zip : p.city.toLowerCase() === city.toLowerCase();
    return (
      samePlace &&
      p.price >= priceMin &&
      p.price <= priceMax &&
      Math.abs(p.beds - input.beds) <= 1 &&
      Math.abs(p.baths - input.baths) <= 1 &&
      p.sqft >= sqftMin &&
      p.sqft <= sqftMax
    );
  });
}

/** Best-effort: enrich a PropertyInput with city/zip for deal scoring on the client. */
export function toRecommendationProperty(p: PropertyInput, fallbackLocation = ""): RecommendationProperty {
  const loc = (p.address || fallbackLocation).trim();
  const { city, zip } = parseCityZip(loc);
  return {
    ...p,
    location: loc || "Unknown",
    city: city || "Local Area",
    zip,
  };
}
