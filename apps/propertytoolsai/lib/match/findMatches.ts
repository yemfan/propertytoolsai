import { getListingsAdapter } from "@/lib/listings/adapters";
import type { ListingResult } from "@/lib/listings/adapters/types";
import { calculateMatchScore } from "@/lib/match/engine";
import type { BuyerPreferences, MatchableListing, PropertyMatch } from "@/lib/match/types";

const MOCK_LISTINGS: MatchableListing[] = [
  {
    id: "mock-1",
    address: "123 Main St",
    city: "Pasadena",
    state: "CA",
    price: 800000,
    beds: 3,
    baths: 2,
    sqft: 1500,
    daysOnMarket: 5,
    propertyType: "single_family",
  },
  {
    id: "mock-2",
    address: "88 Oak Ave",
    city: "Pasadena",
    state: "CA",
    price: 850000,
    beds: 4,
    baths: 3,
    sqft: 1800,
    daysOnMarket: 40,
    propertyType: "single_family",
  },
];

function listingToMatchable(row: ListingResult): MatchableListing {
  return {
    id: row.id,
    address: row.address,
    city: row.city,
    state: row.state,
    price: row.price,
    beds: row.beds,
    baths: row.baths,
    sqft: row.sqft,
    daysOnMarket: row.daysOnMarket,
    propertyType: row.propertyType,
  };
}

export function parseMatchPreferences(body: unknown): BuyerPreferences | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const budget = Number(b.budget);
  if (!Number.isFinite(budget) || budget <= 0) return null;

  const beds = b.beds != null && b.beds !== "" ? Number(b.beds) : undefined;
  const baths = b.baths != null && b.baths !== "" ? Number(b.baths) : undefined;

  const lifestyle = b.lifestyle;
  const timeline = b.timeline;

  return {
    budget,
    city: typeof b.city === "string" ? b.city : undefined,
    state: typeof b.state === "string" ? b.state : "CA",
    beds: Number.isFinite(beds) && (beds as number) > 0 ? beds : undefined,
    baths: Number.isFinite(baths) && (baths as number) > 0 ? baths : undefined,
    lifestyle:
      lifestyle === "family" ||
      lifestyle === "investment" ||
      lifestyle === "commute" ||
      lifestyle === "luxury"
        ? lifestyle
        : undefined,
    timeline:
      timeline === "asap" || timeline === "3_months" || timeline === "6_months" ? timeline : undefined,
  };
}

export async function findPropertyMatches(prefs: BuyerPreferences): Promise<{
  matches: PropertyMatch[];
  provider: "live" | "mock";
}> {
  let listings: MatchableListing[] = [];
  let usedMock = false;

  try {
    const adapter = getListingsAdapter();
    const results = await adapter.searchHomes({
      city: prefs.city,
      state: prefs.state || "CA",
      maxPrice: Math.round(prefs.budget * 1.2),
      minPrice: Math.round(Math.max(50_000, prefs.budget * 0.35)),
      beds: prefs.beds,
      baths: prefs.baths,
      limit: 48,
    });
    listings = results.map(listingToMatchable);
  } catch (e) {
    usedMock = true;
    console.warn("[match] listing provider failed, using mock data:", e);
  }

  if (!listings.length) {
    listings = MOCK_LISTINGS;
    usedMock = true;
  }

  const matches = listings
    .map((p) => calculateMatchScore(prefs, p))
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 24);

  return { matches, provider: usedMock ? "mock" : "live" };
}
