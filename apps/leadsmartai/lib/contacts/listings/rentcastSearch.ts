import "server-only";

import type { SavedSearchCriteria } from "@/lib/contacts/types";

/**
 * Active listings search via Rentcast /v1/listings/sale. Translates a
 * SavedSearchCriteria into their query params and returns a small,
 * normalized shape the digest email template can render.
 *
 * Separate from apps/propertytoolsai/lib/valuation/adapters/rentcast.ts
 * (which handles AVM + comps) because:
 *   - leadsmartai's cron runs on the agent side and needs its own
 *     adapter path (propertytoolsai's adapter imports from its own
 *     tsconfig paths and uses different response shapes)
 *   - The listings endpoint has different query semantics (location-
 *     filter + price-range vs. AVM's single-address lookup)
 *
 * Error handling: 401 (key revoked / quota exceeded), 429
 * (rate-limited), and network failures all return an empty list with
 * a logged warning. Cron-level logic decides whether to retry or
 * skip the search for this run. We never let Rentcast issues crash
 * the cron.
 */

export type RentcastListing = {
  id: string;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  propertyType: string | null;
  listedAt: string | null;
  photoUrl: string | null;
};

const LISTINGS_ENDPOINT = "https://api.rentcast.io/v1/listings/sale";

function toQueryString(params: Record<string, string | number | undefined>): string {
  const filtered: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    filtered[k] = String(v);
  }
  return new URLSearchParams(filtered).toString();
}

/**
 * Map a SavedSearchCriteria into Rentcast query params. Rentcast's
 * listings endpoint accepts: city, state, zipCode, bedrooms, bathrooms,
 * propertyType, maxPrice, minPrice, squareFootage, limit, status.
 */
function criteriaToRentcastQuery(c: SavedSearchCriteria): Record<string, string | number | undefined> {
  const q: Record<string, string | number | undefined> = {
    status: "Active",
    limit: 25,
  };
  if (c.city) q.city = c.city;
  if (c.state) q.state = c.state;
  if (c.zip) q.zipCode = c.zip;
  if (c.bedsMin) q.bedrooms = c.bedsMin;
  if (c.bathsMin) q.bathrooms = c.bathsMin;
  if (c.priceMin) q.minPrice = c.priceMin;
  if (c.priceMax) q.maxPrice = c.priceMax;
  if (c.propertyType && c.propertyType !== "any") {
    // Rentcast uses "Single Family", "Condo", "Townhouse", "Multi-Family"
    const map: Record<string, string> = {
      single_family: "Single Family",
      condo: "Condo",
      townhouse: "Townhouse",
      multi_family: "Multi-Family",
    };
    q.propertyType = map[c.propertyType] ?? c.propertyType;
  }
  return q;
}

function sanitizeNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapRentcastRow(row: Record<string, unknown>): RentcastListing {
  // Rentcast inconsistency: id can be `id`, `propertyId`, or a hash of
  // address. Use the first present + fall back to a synthetic key so
  // dedup keys remain stable across runs.
  const id =
    (row.id as string | undefined) ??
    (row.propertyId as string | undefined) ??
    (row.listingId as string | undefined) ??
    String(row.formattedAddress ?? row.addressLine1 ?? "");

  const photo =
    Array.isArray(row.photos) && row.photos.length > 0
      ? String(row.photos[0])
      : (row.photoUrl as string | undefined) ?? null;

  return {
    id,
    address: String(row.formattedAddress ?? row.addressLine1 ?? "Unknown address"),
    city: (row.city as string | null) ?? null,
    state: (row.state as string | null) ?? null,
    zip: (row.zipCode as string | null) ?? (row.zip as string | null) ?? null,
    price: sanitizeNumber(row.price ?? row.listPrice),
    beds: sanitizeNumber(row.bedrooms),
    baths: sanitizeNumber(row.bathrooms),
    sqft: sanitizeNumber(row.squareFootage ?? row.sqft),
    propertyType: (row.propertyType as string | null) ?? null,
    listedAt:
      (row.listDate as string | null) ??
      (row.listedDate as string | null) ??
      (row.createdDate as string | null) ??
      null,
    photoUrl: photo,
  };
}

export async function findMatchingListings(
  criteria: SavedSearchCriteria,
): Promise<{ ok: true; listings: RentcastListing[] } | { ok: false; reason: string }> {
  const apiKey = process.env.RENTCAST_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, reason: "RENTCAST_API_KEY not set" };
  }

  const qs = toQueryString(criteriaToRentcastQuery(criteria));
  const url = `${LISTINGS_ENDPOINT}?${qs}`;

  try {
    const res = await fetch(url, {
      headers: {
        "X-Api-Key": apiKey,
        accept: "application/json",
      },
    });
    if (res.status === 401) {
      console.error("[rentcast] listings 401 — key invalid or quota exhausted");
      return { ok: false, reason: "unauthorized" };
    }
    if (res.status === 429) {
      console.warn("[rentcast] listings 429 — rate limited, will retry next run");
      return { ok: false, reason: "rate_limited" };
    }
    if (!res.ok) {
      console.error("[rentcast] listings non-OK", res.status);
      return { ok: false, reason: `http_${res.status}` };
    }
    const json = (await res.json().catch(() => null)) as unknown;
    const rows = Array.isArray(json)
      ? json
      : (json as { data?: unknown[] })?.data ?? [];
    const listings = rows
      .filter((r): r is Record<string, unknown> => r != null && typeof r === "object")
      .map(mapRentcastRow)
      .filter((l) => l.id && l.price && l.price > 0);
    return { ok: true, listings };
  } catch (e) {
    console.error("[rentcast] listings fetch failed", e);
    return { ok: false, reason: "fetch_error" };
  }
}
