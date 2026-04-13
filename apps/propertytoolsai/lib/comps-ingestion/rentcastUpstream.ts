import { getPropertyData } from "@/lib/getPropertyData";
import { getPropertyByAddress } from "@/lib/propertyService";
import { loadValuationBundleFromRentcast } from "@/lib/valuation/adapters/rentcast";
import type { ComparableSale, SubjectPropertyInput } from "@/lib/valuation/types";
import { propertyRowToSubjectLookup } from "./subject";
import type { NearbyCompCandidate, SubjectLookupResult } from "./types";

export async function fetchSubjectFromUpstream(address: string): Promise<SubjectLookupResult | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;
  try {
    await getPropertyData(trimmed, true);
  } catch {
    /* warehouse may still have partial row */
  }
  const row = await getPropertyByAddress(trimmed);
  if (!row) return null;
  return propertyRowToSubjectLookup(row);
}

function subjectToRentcastInput(subject: SubjectLookupResult): SubjectPropertyInput {
  return {
    address: subject.normalizedAddress,
    city: subject.city ?? undefined,
    state: subject.state ?? undefined,
    zip: subject.zipCode ?? undefined,
    lat: subject.lat ?? undefined,
    lng: subject.lng ?? undefined,
    beds: subject.beds ?? undefined,
    baths: subject.baths ?? undefined,
    sqft: subject.sqft ?? undefined,
  };
}

function comparableSaleToNearby(c: ComparableSale): NearbyCompCandidate {
  return {
    externalId: null,
    address: c.address,
    zipCode: c.zip ?? null,
    soldPrice: c.soldPrice,
    soldDate: c.soldDate,
    beds: c.beds ?? null,
    baths: c.baths ?? null,
    sqft: c.sqft ?? null,
    yearBuilt: c.yearBuilt ?? null,
    propertyType: c.propertyType ?? null,
    distanceMiles: c.distanceMiles ?? null,
    listPrice: null,
    listingStatus: "sold",
    city: null,
    state: null,
    lat: null,
    lng: null,
  };
}

export async function fetchNearbySoldCompsFromUpstream(
  subject: SubjectLookupResult,
  maxMiles: number,
  limit = 100
): Promise<NearbyCompCandidate[]> {
  if (!process.env.RENTCAST_API_KEY?.trim()) {
    console.warn(
      "[comps-ingestion] RENTCAST_API_KEY is not set — Rentcast " +
      "fallback is disabled. The comp search can only use the " +
      "local warehouse, which may not have enough recent sales. " +
      "Set RENTCAST_API_KEY in your environment to enable the " +
      "upstream comp feed."
    );
    return [];
  }

  const bundle = await loadValuationBundleFromRentcast(subjectToRentcastInput(subject));

  return bundle.comps
    .filter((c) => c.soldPrice > 0)
    .filter(
      (c) =>
        maxMiles <= 0 ||
        typeof c.distanceMiles !== "number" ||
        (Number.isFinite(c.distanceMiles) && c.distanceMiles <= maxMiles)
    )
    .slice(0, Math.max(1, limit))
    .map(comparableSaleToNearby);
}
