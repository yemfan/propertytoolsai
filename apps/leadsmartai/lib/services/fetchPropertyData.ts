import "server-only";
import type { PropertyCore } from "./propertyService";

/**
 * Property data fetched for an address. Extends PropertyCore with the
 * listing-side fields the consumers of `/api/property/[address]` and
 * the warehouse snapshot data blob actually read off — most notably
 * the showings/new auto-fill flow which looks for `mlsNumber`,
 * `listingUrl`, and the listing-agent contact fields, and the
 * status banner which keys off `listing_status`.
 *
 * If Rentcast returns no row for the address (or the API key isn't
 * configured), every nullable field comes back null and required
 * strings come back empty. NO fabricated values — callers must treat
 * an empty result as "no data" and surface the appropriate empty
 * state instead of acting on bogus numbers.
 *
 * History note: until this file was rewritten, `fetchPropertyData`
 * was a stub returning hardcoded "Los Angeles 90001 / 3 bed / 2 bath
 * / 1500 sqft / $800k / $3200 rent" for every address ever queried.
 * That poisoned the warehouse `properties` table and every snapshot
 * for a year. The 12 callers (lead capture, presentation generation,
 * flyer, property report, estimate, showings auto-fill, etc.) were
 * all silently consuming the same fake row.
 */
export type PropertyFetchResult = PropertyCore & {
  listing_status: string | null;
  mlsNumber: string | null;
  mlsName: string | null;
  listingUrl: string | null;
  listingAgentName: string | null;
  listingAgentEmail: string | null;
  listingAgentPhone: string | null;
  year_built: number | null;
  lot_size: number | null;
  property_type: string | null;
  lat: number | null;
  lng: number | null;
};

const RENTCAST_LISTINGS_ENDPOINT = "https://api.rentcast.io/v1/listings/sale";
const RENTCAST_PROPERTIES_ENDPOINT = "https://api.rentcast.io/v1/properties";

function emptyResult(address: string): PropertyFetchResult {
  return {
    address,
    city: "",
    state: "",
    zip: "",
    beds: null,
    baths: null,
    sqft: null,
    price: null,
    rent: null,
    listing_status: null,
    mlsNumber: null,
    mlsName: null,
    listingUrl: null,
    listingAgentName: null,
    listingAgentEmail: null,
    listingAgentPhone: null,
    year_built: null,
    lot_size: null,
    property_type: null,
    lat: null,
    lng: null,
  };
}

function asNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function asStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

/**
 * Rentcast returns either an array directly (`[{...}, ...]`) or an
 * envelope (`{ data: [...] }`) depending on plan/endpoint version.
 * Pull the first row regardless of shape.
 */
function pickFirstRow(json: unknown): Record<string, unknown> | null {
  if (Array.isArray(json) && json.length > 0 && json[0] && typeof json[0] === "object") {
    return json[0] as Record<string, unknown>;
  }
  if (json && typeof json === "object") {
    const data = (json as { data?: unknown }).data;
    if (Array.isArray(data) && data.length > 0 && data[0] && typeof data[0] === "object") {
      return data[0] as Record<string, unknown>;
    }
  }
  return null;
}

/**
 * Fetches property + active listing data for an address from Rentcast.
 *
 * Strategy:
 *   1. Hit `/v1/listings/sale` (active listing — has MLS#, listing
 *      agent contact, status). Authoritative when the property is
 *      currently on-market.
 *   2. In parallel, hit `/v1/properties` (the property record — has
 *      year_built, lot_size, last sale price). Used to fill in fields
 *      the active-listing row may not return, and used standalone
 *      when the property isn't currently listed.
 *
 * Returns:
 *   - Real data when either endpoint returns a row.
 *   - emptyResult(address) when both endpoints return zero rows OR
 *     when RENTCAST_API_KEY isn't configured. (Empty string for the
 *     required string fields and null for everything else — callers
 *     read this as "no data" and render the appropriate empty state.)
 *   - Throws on Rentcast 5xx so callers can surface the outage.
 */
export async function fetchPropertyData(address: string): Promise<PropertyFetchResult> {
  const apiKey = process.env.RENTCAST_API_KEY?.trim();
  if (!apiKey) return emptyResult(address);

  const params = new URLSearchParams({ address });
  const headers = { Accept: "application/json", "X-Api-Key": apiKey };

  const [listingRes, propertyRes] = await Promise.all([
    fetch(`${RENTCAST_LISTINGS_ENDPOINT}?${params.toString()}`, {
      headers,
      cache: "no-store",
    }),
    fetch(`${RENTCAST_PROPERTIES_ENDPOINT}?${params.toString()}`, {
      headers,
      cache: "no-store",
    }),
  ]);

  if (!listingRes.ok && listingRes.status >= 500) {
    throw new Error(`Rentcast /listings/sale returned ${listingRes.status}`);
  }
  if (!propertyRes.ok && propertyRes.status >= 500) {
    throw new Error(`Rentcast /properties returned ${propertyRes.status}`);
  }

  const listingJson = listingRes.ok ? await listingRes.json().catch(() => null) : null;
  const propertyJson = propertyRes.ok ? await propertyRes.json().catch(() => null) : null;

  const listingRow = pickFirstRow(listingJson);
  const propertyRow = pickFirstRow(propertyJson);

  if (!listingRow && !propertyRow) {
    return emptyResult(address);
  }

  // Active-listing row wins for shared fields (MLS#, agent, status).
  // Property row supplements year_built / lot_size when the listing
  // row doesn't carry them.
  const r = listingRow ?? propertyRow ?? {};
  const agent = (r.listingAgent ?? {}) as Record<string, unknown>;

  return {
    address,
    city: asStr(r.city) ?? asStr(propertyRow?.city) ?? "",
    state: asStr(r.state) ?? asStr(propertyRow?.state) ?? "",
    zip: asStr(r.zipCode ?? r.zip ?? r.postalCode) ??
      asStr(propertyRow?.zipCode ?? propertyRow?.zip) ?? "",
    beds: asNum(r.bedrooms) ?? asNum(propertyRow?.bedrooms),
    baths: asNum(r.bathrooms) ?? asNum(propertyRow?.bathrooms),
    sqft: asNum(r.squareFootage) ?? asNum(propertyRow?.squareFootage),
    price: asNum(r.price ?? r.listPrice),
    // Rent estimate isn't returned by /listings/sale or /properties
    // — the Rentcast AVM endpoint owns that. Leaving null here is
    // honest; presentation/flyer surfaces that need rent should call
    // the AVM separately.
    rent: null,
    listing_status: asStr(r.status),
    mlsNumber: asStr(r.mlsNumber),
    mlsName: asStr(r.mlsName),
    listingUrl: asStr(r.listingUrl ?? r.url),
    listingAgentName: asStr(r.listingAgentName ?? r.agentName ?? r.listAgentName ?? agent.name),
    listingAgentEmail: asStr(r.listingAgentEmail ?? agent.email),
    listingAgentPhone: asStr(r.listingAgentPhone ?? agent.phone),
    year_built: asNum(r.yearBuilt) ?? asNum(propertyRow?.yearBuilt),
    lot_size: asNum(r.lotSize) ?? asNum(propertyRow?.lotSize),
    property_type: asStr(r.propertyType) ?? asStr(propertyRow?.propertyType),
    lat: asNum(r.latitude) ?? asNum(propertyRow?.latitude),
    lng: asNum(r.longitude) ?? asNum(propertyRow?.longitude),
  };
}
