import type { HomeValueEstimateRequest, NormalizedProperty } from "./types";
import type { PropertyRow } from "@/lib/propertyService";

/**
 * Merge warehouse row + client request into a single normalized property.
 */
export function mergeNormalizedProperty(
  address: string,
  row: PropertyRow | null,
  req: HomeValueEstimateRequest
): NormalizedProperty {
  const beds = req.beds ?? row?.beds ?? null;
  const baths = req.baths ?? row?.baths ?? null;
  const sqft = req.sqft ?? row?.sqft ?? null;
  const lotSqft = req.lotSqft ?? row?.lot_size ?? null;
  const yearBuilt = req.yearBuilt ?? row?.year_built ?? null;
  const propertyType = (req.propertyType ?? row?.property_type ?? "single family").trim();

  const missingFields: string[] = [];
  if (!(beds != null && beds > 0)) missingFields.push("beds");
  if (!(baths != null && baths > 0)) missingFields.push("baths");
  if (!(sqft != null && sqft > 0)) missingFields.push("sqft");
  if (!(lotSqft != null && lotSqft > 0)) missingFields.push("lotSqft");
  if (!(yearBuilt != null && yearBuilt > 1800)) missingFields.push("yearBuilt");
  if (!propertyType.length) missingFields.push("propertyType");

  return {
    address,
    city: req.city ?? row?.city ?? null,
    state: req.state ?? row?.state ?? null,
    zip: req.zip ?? row?.zip_code ?? null,
    lat: req.lat ?? row?.lat ?? null,
    lng: req.lng ?? row?.lng ?? null,
    beds,
    baths,
    sqft,
    lotSqft,
    yearBuilt,
    propertyType,
    missingFields,
  };
}
