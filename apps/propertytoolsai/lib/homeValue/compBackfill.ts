/**
 * Comp detail backfill — enriches warehouse comps that are missing
 * beds, baths, or sqft by fetching from Rentcast /v1/properties.
 *
 * This prevents comps from being excluded from the weighted PPSF
 * calculation (which requires sqft) and improves similarity scoring.
 *
 * Rate-limited to avoid burning API credits: at most 5 lookups per
 * estimate run. Results are written back to the warehouse so future
 * estimates benefit from the enrichment.
 */

import { upsertPropertyWarehouse, type PropertyRow } from "@/lib/propertyService";

const MAX_BACKFILL_PER_RUN = 5;

export type BackfillResult = {
  /** How many comps were missing key details. */
  candidateCount: number;
  /** How many were successfully enriched. */
  enrichedCount: number;
  /** IDs of enriched comp properties. */
  enrichedIds: string[];
};

type CompForBackfill = {
  comp_property_id: string;
  comp_property?: {
    id: string;
    address: string;
    city: string | null;
    state: string | null;
    zip_code: string | null;
    lat: number | null;
    lng: number | null;
    beds: number | null;
    baths: number | null;
    sqft: number | null;
    lot_size: number | null;
    year_built: number | null;
    property_type: string | null;
  } | null;
};

/**
 * Identifies comps missing key details (beds, baths, sqft) and
 * enriches them from Rentcast. Returns updated comp rows.
 *
 * Requires RENTCAST_API_KEY.
 */
export async function backfillCompDetails(
  comps: CompForBackfill[]
): Promise<BackfillResult> {
  const apiKey = process.env.RENTCAST_API_KEY?.trim();
  if (!apiKey) {
    return { candidateCount: 0, enrichedCount: 0, enrichedIds: [] };
  }

  // Find comps missing sqft (critical for PPSF) or beds/baths (for similarity)
  const candidates = comps.filter((c) => {
    const p = c.comp_property;
    if (!p?.address) return false;
    return p.sqft == null || p.beds == null || p.baths == null;
  });

  if (candidates.length === 0) {
    return { candidateCount: 0, enrichedCount: 0, enrichedIds: [] };
  }

  // Limit API calls per run
  const toFetch = candidates.slice(0, MAX_BACKFILL_PER_RUN);
  const enrichedIds: string[] = [];

  for (const comp of toFetch) {
    const p = comp.comp_property;
    if (!p?.address) continue;

    try {
      const details = await fetchPropertyFromRentcast(p.address, apiKey);
      if (!details) continue;

      // Merge: only fill in what's missing, don't overwrite existing data
      const updates: Record<string, unknown> = { address: p.address };
      if (p.sqft == null && details.sqft != null) updates.sqft = details.sqft;
      if (p.beds == null && details.beds != null) updates.beds = details.beds;
      if (p.baths == null && details.baths != null) updates.baths = details.baths;
      if (p.year_built == null && details.yearBuilt != null) updates.year_built = details.yearBuilt;
      if (p.lot_size == null && details.lotSize != null) updates.lot_size = details.lotSize;
      if (p.property_type == null && details.propertyType != null) updates.property_type = details.propertyType;
      if (p.city == null && details.city != null) updates.city = details.city;
      if (p.state == null && details.state != null) updates.state = details.state;
      if (p.zip_code == null && details.zip != null) updates.zip_code = details.zip;
      if (p.lat == null && details.lat != null) updates.lat = details.lat;
      if (p.lng == null && details.lng != null) updates.lng = details.lng;

      // Only upsert if we actually have new data
      const hasNewData = Object.keys(updates).length > 1; // more than just address
      if (hasNewData) {
        await upsertPropertyWarehouse(updates as Parameters<typeof upsertPropertyWarehouse>[0]);
        enrichedIds.push(p.id);
        console.log(
          `[compBackfill] Enriched ${p.address}: ` +
          `sqft=${details.sqft ?? "?"}, beds=${details.beds ?? "?"}, baths=${details.baths ?? "?"}`
        );
      }
    } catch (e) {
      console.warn(`[compBackfill] Failed to backfill ${p.address}:`, e);
    }
  }

  return {
    candidateCount: candidates.length,
    enrichedCount: enrichedIds.length,
    enrichedIds,
  };
}

type RentcastPropertyDetails = {
  sqft: number | null;
  beds: number | null;
  baths: number | null;
  yearBuilt: number | null;
  lotSize: number | null;
  propertyType: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
};

/**
 * Fetch property details from Rentcast /v1/properties endpoint.
 */
async function fetchPropertyFromRentcast(
  address: string,
  apiKey: string
): Promise<RentcastPropertyDetails | null> {
  try {
    const params = new URLSearchParams({ address });
    const res = await fetch(
      `https://api.rentcast.io/v1/properties?${params.toString()}`,
      {
        headers: {
          Accept: "application/json",
          "X-Api-Key": apiKey,
        },
        signal: AbortSignal.timeout(6000),
        cache: "no-store",
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    // Response is an array or object with a data array
    const record = Array.isArray(data)
      ? data[0]
      : data?.data?.[0] ?? (data?.squareFootage != null ? data : null);

    if (!record || typeof record !== "object") return null;

    return {
      sqft: sanitizeNumber(record.squareFootage),
      beds: sanitizeNumber(record.bedrooms),
      baths: sanitizeNumber(record.bathrooms),
      yearBuilt: sanitizeNumber(record.yearBuilt),
      lotSize: sanitizeNumber(record.lotSize),
      propertyType: record.propertyType ? String(record.propertyType) : null,
      city: record.city ? String(record.city) : null,
      state: record.state ? String(record.state) : null,
      zip: record.zipCode ? String(record.zipCode) : null,
      lat: sanitizeNumber(record.latitude),
      lng: sanitizeNumber(record.longitude),
    };
  } catch (e) {
    console.warn(`[compBackfill] Rentcast fetch failed for ${address}:`, e);
    return null;
  }
}

function sanitizeNumber(val: unknown): number | null {
  if (val == null) return null;
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? n : null;
}
