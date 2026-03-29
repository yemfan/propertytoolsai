import { getPropertyByAddress, upsertPropertyWarehouse, type PropertyRow } from "@/lib/propertyService";
import { normalizeWarehouseAddress } from "./normalize";
import type { SubjectLookupResult } from "./types";

export function propertyRowToSubjectLookup(row: PropertyRow): SubjectLookupResult {
  return {
    foundInWarehouse: true,
    subjectId: row.id,
    normalizedAddress: row.address,
    lat: row.lat,
    lng: row.lng,
    zipCode: row.zip_code,
    city: row.city,
    state: row.state,
    propertyType: row.property_type,
    beds: row.beds,
    baths: row.baths,
    sqft: row.sqft,
  };
}

export async function resolveSubjectFromWarehouse(address: string): Promise<SubjectLookupResult | null> {
  const row = await getPropertyByAddress(address);
  if (!row) return null;
  return propertyRowToSubjectLookup(row);
}

export async function upsertSubjectIntoWarehouse(subject: {
  address: string;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  lat?: number | null;
  lng?: number | null;
  propertyType?: string | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  yearBuilt?: number | null;
  lotSize?: number | null;
}) {
  const key = normalizeWarehouseAddress(subject.address);
  const row = await upsertPropertyWarehouse({
    address: key,
    city: subject.city ?? null,
    state: subject.state ?? null,
    zip_code: subject.zipCode ?? null,
    lat: subject.lat ?? null,
    lng: subject.lng ?? null,
    property_type: subject.propertyType ?? null,
    beds: subject.beds ?? null,
    baths: subject.baths ?? null,
    sqft: subject.sqft ?? null,
    year_built: subject.yearBuilt ?? null,
    lot_size: subject.lotSize ?? null,
  });
  return { id: row.id, addressKey: row.address };
}
