import "server-only";

import type {
  IdxAdapter,
  IdxAdapterFailure,
  IdxAdapterResult,
  IdxListingDetail,
  IdxListingStatus,
  IdxListingSummary,
  IdxPropertyType,
  IdxSearchFilters,
  IdxSearchResult,
} from "@/lib/idx/types";

/**
 * Rentcast IDX adapter. Demo-tier provider — Rentcast aggregates MLS data
 * across the US and permits public display under their API license
 * (verified 2026-04, see docs/RENTCAST_TOS_NOTES.md).
 *
 * For production / serious-team customers we'll add a second adapter (IDX
 * Broker or MLS Grid) and switch via `getIdxAdapter()`.
 *
 * Rentcast quirks worth knowing:
 *   - Listing id can be `id`, `propertyId`, or `listingId` depending on row.
 *   - Photos are returned as a `photos[]` array of URLs (sometimes a single hero).
 *   - `propertyType` uses human strings ("Single Family"), not enums.
 *   - The detail endpoint sometimes returns 404 for stale listings even when
 *     they appeared in a recent search — surface as `not_found` cleanly.
 */

const SEARCH_ENDPOINT = "https://api.rentcast.io/v1/listings/sale";
const DETAIL_ENDPOINT = "https://api.rentcast.io/v1/listings/sale";

const RENTCAST_TYPE_TO_IDX: Record<string, IdxPropertyType> = {
  "Single Family": "single_family",
  Condo: "condo",
  Townhouse: "townhouse",
  "Multi-Family": "multi_family",
  Land: "land",
};

const IDX_TYPE_TO_RENTCAST: Record<IdxPropertyType, string> = {
  single_family: "Single Family",
  condo: "Condo",
  townhouse: "Townhouse",
  multi_family: "Multi-Family",
  land: "Land",
  other: "Other",
};

const STATUS_TO_RENTCAST: Record<IdxListingStatus, string> = {
  active: "Active",
  pending: "Pending",
  sold: "Sold",
  off_market: "Inactive",
};

function getApiKey(): string | null {
  const key = process.env.RENTCAST_API_KEY?.trim();
  return key ? key : null;
}

function toQueryString(params: Record<string, string | number | undefined>): string {
  const filtered: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    filtered[k] = String(v);
  }
  return new URLSearchParams(filtered).toString();
}

function asNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function asString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function pickListingId(row: Record<string, unknown>): string {
  return (
    asString(row.id) ??
    asString(row.propertyId) ??
    asString(row.listingId) ??
    asString(row.formattedAddress) ??
    asString(row.addressLine1) ??
    ""
  );
}

function mapPropertyType(raw: unknown): IdxPropertyType | null {
  const s = asString(raw);
  if (!s) return null;
  return RENTCAST_TYPE_TO_IDX[s] ?? "other";
}

function mapStatus(raw: unknown): IdxListingStatus {
  const s = asString(raw)?.toLowerCase();
  if (!s) return "active";
  if (s.includes("pending")) return "pending";
  if (s.includes("sold")) return "sold";
  if (s.includes("inactive") || s.includes("off")) return "off_market";
  return "active";
}

function mapPhotos(row: Record<string, unknown>): string[] {
  const raw = row.photos;
  if (!Array.isArray(raw)) {
    const single = asString(row.photoUrl);
    return single ? [single] : [];
  }
  return raw.map((u) => asString(u)).filter((u): u is string => u !== null);
}

function mapSummary(row: Record<string, unknown>): IdxListingSummary | null {
  const id = pickListingId(row);
  if (!id) return null;
  const photos = mapPhotos(row);
  return {
    id,
    mlsName: asString(row.mlsName),
    mlsNumber: asString(row.mlsNumber),
    formattedAddress: asString(row.formattedAddress) ?? asString(row.addressLine1) ?? "Unknown address",
    city: asString(row.city),
    state: asString(row.state),
    zip: asString(row.zipCode) ?? asString(row.zip),
    lat: asNumber(row.latitude),
    lng: asNumber(row.longitude),
    price: asNumber(row.price ?? row.listPrice),
    beds: asNumber(row.bedrooms),
    baths: asNumber(row.bathrooms),
    sqft: asNumber(row.squareFootage ?? row.sqft),
    propertyType: mapPropertyType(row.propertyType),
    status: mapStatus(row.status),
    listedAt: asString(row.listDate ?? row.listedDate ?? row.createdDate),
    heroPhoto: photos[0] ?? null,
  };
}

function mapDetail(row: Record<string, unknown>): IdxListingDetail | null {
  const summary = mapSummary(row);
  if (!summary) return null;
  const photos = mapPhotos(row);
  const lastSeen = asString(row.lastSeenDate);
  const listed = asString(row.listDate ?? row.listedDate ?? row.createdDate);
  const dom = computeDaysOnMarket(listed, lastSeen);
  return {
    ...summary,
    yearBuilt: asNumber(row.yearBuilt),
    lotSize: asNumber(row.lotSize),
    daysOnMarket: dom,
    description: asString(row.description ?? row.publicRemarks ?? row.remarks),
    photos,
    listingBrokerName: asString(row.listingBrokerName ?? row.officeName ?? row.listOfficeName),
    listingAgentName: asString(row.listingAgentName ?? row.agentName ?? row.listAgentName),
  };
}

function computeDaysOnMarket(listed: string | null, lastSeen: string | null): number | null {
  if (!listed) return null;
  const start = Date.parse(listed);
  const end = lastSeen ? Date.parse(lastSeen) : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, Math.floor((end - start) / 86_400_000));
}

function filtersToRentcastQuery(filters: IdxSearchFilters): Record<string, string | number | undefined> {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const pageSize = filters.pageSize && filters.pageSize > 0 ? Math.min(filters.pageSize, 100) : 25;
  const offset = (page - 1) * pageSize;
  const q: Record<string, string | number | undefined> = {
    status: STATUS_TO_RENTCAST[filters.status ?? "active"],
    limit: pageSize,
    offset,
  };
  if (filters.city) q.city = filters.city;
  if (filters.state) q.state = filters.state;
  if (filters.zip) q.zipCode = filters.zip;
  if (filters.bedsMin) q.bedrooms = filters.bedsMin;
  if (filters.bathsMin) q.bathrooms = filters.bathsMin;
  if (filters.priceMin) q.minPrice = filters.priceMin;
  if (filters.priceMax) q.maxPrice = filters.priceMax;
  if (filters.sqftMin) q.squareFootage = filters.sqftMin;
  if (filters.propertyType) q.propertyType = IDX_TYPE_TO_RENTCAST[filters.propertyType];
  return q;
}

type RawFetchSuccess = { ok: true; json: unknown };
type RawFetchResult = RawFetchSuccess | IdxAdapterFailure;

function isRawFailure(r: RawFetchResult): r is IdxAdapterFailure {
  return r.ok === false;
}

async function rentcastFetch(
  url: string,
  apiKey: string,
  revalidate: number,
): Promise<RawFetchResult> {
  try {
    const res = await fetch(url, {
      headers: {
        "X-Api-Key": apiKey,
        accept: "application/json",
      },
      next: { revalidate },
    });
    if (res.status === 401) return { ok: false, error: { kind: "unauthorized" } };
    if (res.status === 404) return { ok: false, error: { kind: "not_found" } };
    if (res.status === 429) return { ok: false, error: { kind: "rate_limited" } };
    if (!res.ok) return { ok: false, error: { kind: "provider_error", status: res.status } };
    const json = await res.json().catch(() => null);
    if (json === null) return { ok: false, error: { kind: "fetch_error", message: "invalid_json" } };
    return { ok: true, json };
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown";
    return { ok: false, error: { kind: "fetch_error", message } };
  }
}

export const rentcastIdxAdapter: IdxAdapter = {
  providerId: "rentcast",

  async searchListings(filters) {
    const apiKey = getApiKey();
    if (!apiKey) {
      return { ok: false, error: { kind: "not_configured", reason: "RENTCAST_API_KEY not set" } };
    }
    const qs = toQueryString(filtersToRentcastQuery(filters));
    const url = `${SEARCH_ENDPOINT}?${qs}`;
    const fetched = await rentcastFetch(url, apiKey, 300); // 5-min cache for SRP
    if (isRawFailure(fetched)) return fetched;
    const rows = Array.isArray(fetched.json)
      ? fetched.json
      : (fetched.json as { data?: unknown[] })?.data ?? [];
    const listings = rows
      .filter((r): r is Record<string, unknown> => r != null && typeof r === "object")
      .map(mapSummary)
      .filter((l): l is IdxListingSummary => l !== null);
    const result: IdxSearchResult = {
      listings,
      total: null, // Rentcast does not return a total-match count
      page: filters.page ?? 1,
      pageSize: filters.pageSize ?? 25,
    };
    return { ok: true, data: result };
  },

  async getListing(id) {
    const apiKey = getApiKey();
    if (!apiKey) {
      return { ok: false, error: { kind: "not_configured", reason: "RENTCAST_API_KEY not set" } };
    }
    const url = `${DETAIL_ENDPOINT}/${encodeURIComponent(id)}`;
    const fetched = await rentcastFetch(url, apiKey, 1800); // 30-min cache for PDP
    if (isRawFailure(fetched)) return fetched;
    // Detail endpoint may return a single object or a one-element array.
    const raw = Array.isArray(fetched.json) ? fetched.json[0] : fetched.json;
    if (!raw || typeof raw !== "object") {
      return { ok: false, error: { kind: "not_found" } };
    }
    const detail = mapDetail(raw as Record<string, unknown>);
    if (!detail) return { ok: false, error: { kind: "not_found" } };
    return { ok: true, data: detail };
  },
};
