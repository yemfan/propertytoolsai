/**
 * Provider-agnostic IDX types. The public IDX site (search results, listing
 * detail, lead capture) talks to these shapes, never to a vendor's raw schema.
 * Swap providers (Rentcast, IDX Broker, MLS Grid, RESO Web API) by writing a
 * new `IdxAdapter` implementation; the UI does not change.
 *
 * Field naming follows RESO Data Dictionary where practical so a future RESO
 * adapter is a near-1:1 mapping.
 */

export type IdxPropertyType =
  | "single_family"
  | "condo"
  | "townhouse"
  | "multi_family"
  | "land"
  | "other";

export type IdxListingStatus = "active" | "pending" | "sold" | "off_market";

export type IdxSearchFilters = {
  city?: string;
  state?: string;
  zip?: string;
  priceMin?: number;
  priceMax?: number;
  bedsMin?: number;
  bathsMin?: number;
  sqftMin?: number;
  propertyType?: IdxPropertyType;
  status?: IdxListingStatus;
  /** 1-indexed for UI ergonomics; adapters translate to offset internally. */
  page?: number;
  pageSize?: number;
};

/** Minimal shape used in search-result cards. Cheap to fetch in bulk. */
export type IdxListingSummary = {
  id: string;
  /** MLS source name (used for attribution; e.g. "Bay East AOR"). May be null. */
  mlsName: string | null;
  mlsNumber: string | null;
  formattedAddress: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  propertyType: IdxPropertyType | null;
  status: IdxListingStatus;
  listedAt: string | null;
  /** Single hero image — full gallery lives on detail. May be null. */
  heroPhoto: string | null;
};

/** Full detail used on the PDP. Adapters may make a separate request to populate. */
export type IdxListingDetail = IdxListingSummary & {
  yearBuilt: number | null;
  lotSize: number | null;
  daysOnMarket: number | null;
  description: string | null;
  /** Photo URLs in display order. May be empty. */
  photos: string[];
  /** Listing brokerage name — required by most MLS IDX rules. */
  listingBrokerName: string | null;
  listingAgentName: string | null;
};

export type IdxSearchResult = {
  listings: IdxListingSummary[];
  /** Total matching the filters (not just this page). May be null if provider doesn't return it. */
  total: number | null;
  page: number;
  pageSize: number;
};

export type IdxAdapterError =
  | { kind: "unauthorized" }
  | { kind: "rate_limited" }
  | { kind: "not_found" }
  | { kind: "provider_error"; status: number }
  | { kind: "fetch_error"; message: string }
  | { kind: "not_configured"; reason: string };

export type IdxAdapterSuccess<T> = { ok: true; data: T };
export type IdxAdapterFailure = { ok: false; error: IdxAdapterError };
export type IdxAdapterResult<T> = IdxAdapterSuccess<T> | IdxAdapterFailure;

export function isIdxFailure<T>(r: IdxAdapterResult<T>): r is IdxAdapterFailure {
  return r.ok === false;
}

export function isIdxSuccess<T>(r: IdxAdapterResult<T>): r is IdxAdapterSuccess<T> {
  return r.ok === true;
}

/**
 * Stable interface every IDX provider implements. Keep this small — features
 * specific to one provider (e.g. saved-search webhooks) live behind capability
 * flags or in vendor-specific helper modules, not here.
 */
export interface IdxAdapter {
  readonly providerId: string;
  searchListings(filters: IdxSearchFilters): Promise<IdxAdapterResult<IdxSearchResult>>;
  getListing(id: string): Promise<IdxAdapterResult<IdxListingDetail>>;
}
