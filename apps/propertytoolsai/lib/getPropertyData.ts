import { getCachedProperty, isCacheExpired, savePropertyToCache } from "@/lib/propertyCache";
import { fetchPropertyData } from "@/lib/services/fetchPropertyData";
import {
  insertSnapshotIfNeeded,
  upsertPropertyWarehouse,
} from "@/lib/propertyService";

type FetchPropertyFromSource = (address: string) => Promise<unknown>;

function getPropertySourceFetcher(): FetchPropertyFromSource {
  // Future-proofing: switch data sources via env var later.
  const useApi = process.env.USE_API === "true";

  if (useApi) {
    return async (address: string) => {
      // Placeholder: swap in RentCast (or other API) implementation here.
      return await fetchPropertyData(address);
    };
  }

  return async (address: string) => {
    return await fetchPropertyData(address);
  };
}

export async function getPropertyData(
  address: string,
  forceRefresh = false
): Promise<unknown> {
  const trimmedAddress = address.trim();
  if (!trimmedAddress) {
    throw new Error("Address is required");
  }

  const cached = await getCachedProperty(trimmedAddress);

  if (!forceRefresh && cached && !isCacheExpired(cached)) {
    console.log("CACHE HIT");
    return cached.data;
  }

  if (!cached) console.log("CACHE MISS");
  else console.log("CACHE EXPIRED - REFETCH");

  const fetchPropertyFromSource = getPropertySourceFetcher();
  const freshData = await fetchPropertyFromSource(trimmedAddress);

  // Ingestion flow (warehouse + snapshots + fast cache)
  // Step 2: upsert properties master row
  const anyFresh = freshData as any;
  const propertyRow = await upsertPropertyWarehouse({
    address: trimmedAddress,
    city: anyFresh?.city ?? null,
    state: anyFresh?.state ?? null,
    zip_code: anyFresh?.zip ?? anyFresh?.zip_code ?? null,
    beds: anyFresh?.beds ?? null,
    baths: anyFresh?.baths ?? null,
    sqft: anyFresh?.sqft ?? null,
    year_built: anyFresh?.year_built ?? null,
    lot_size: anyFresh?.lot_size ?? null,
    property_type: anyFresh?.property_type ?? null,
    lat: anyFresh?.lat ?? null,
    lng: anyFresh?.lng ?? null,
  });

  // Step 3: insert snapshot (if rule passes)
  const estimatedValue = Number(anyFresh?.price ?? anyFresh?.estimated_value ?? NaN);
  const rentEstimate = Number(anyFresh?.rent ?? anyFresh?.rent_estimate ?? NaN);
  const sqft = Number(anyFresh?.sqft ?? NaN);
  const ppsf =
    isFinite(estimatedValue) && isFinite(sqft) && sqft > 0
      ? estimatedValue / sqft
      : null;

  await insertSnapshotIfNeeded({
    propertyId: propertyRow.id,
    estimatedValue: isFinite(estimatedValue) ? estimatedValue : null,
    rentEstimate: isFinite(rentEstimate) ? rentEstimate : null,
    pricePerSqft: ppsf,
    listingStatus: anyFresh?.listing_status ?? null,
    data: freshData,
  });

  // Step 4: update fast cache for quick lookups (180 days TTL)
  await savePropertyToCache(trimmedAddress, freshData, {
    city: propertyRow.city,
    state: propertyRow.state,
    zip_code: propertyRow.zip_code,
  });

  return freshData;
}

