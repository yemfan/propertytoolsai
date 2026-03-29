export type SubjectLookupResult = {
  foundInWarehouse: boolean;
  subjectId?: string | null;
  /** Normalized warehouse address key (matches `properties_warehouse.address`). */
  normalizedAddress: string;
  lat?: number | null;
  lng?: number | null;
  zipCode?: string | null;
  city?: string | null;
  state?: string | null;
  propertyType?: string | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
};

export type CompIngestionStats = {
  subjectResolved: boolean;
  subjectInserted: boolean;
  warehouseCandidatesScanned: number;
  warehouseValidSoldComps: number;
  upstreamCandidatesFetched: number;
  upstreamSoldCompsInserted: number;
  finalValidCompCount: number;
  fallbackUsed: boolean;
  notes: string[];
};

export type NearbyCompCandidate = {
  externalId?: string | null;
  address: string;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  lat?: number | null;
  lng?: number | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  yearBuilt?: number | null;
  propertyType?: string | null;
  soldPrice?: number | null;
  soldDate?: string | null;
  listPrice?: number | null;
  listingStatus?: string | null;
  distanceMiles?: number | null;
};

export type CompSearchTier = {
  key: string;
  maxMiles: number;
  maxSoldAgeDays: number;
  sqftTolerancePct: number;
  batchSize: number;
};
