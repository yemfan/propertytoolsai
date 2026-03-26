import {
  extractCompSaleFromHistory,
  getPropertyHistory,
  loadWarehousePropertiesNearSubject,
  type PropertyRow,
} from "@/lib/propertyService";
import { supabaseServer } from "@/lib/supabaseServer";
import { daysSince, milesBetween } from "./normalize";
import type { CompSearchTier, NearbyCompCandidate, SubjectLookupResult } from "./types";

export const COMP_SEARCH_TIERS: CompSearchTier[] = [
  { key: "tier_1", maxMiles: 0.5, maxSoldAgeDays: 90, sqftTolerancePct: 0.15, batchSize: 12 },
  { key: "tier_2", maxMiles: 1.0, maxSoldAgeDays: 180, sqftTolerancePct: 0.2, batchSize: 12 },
  { key: "tier_3", maxMiles: 1.5, maxSoldAgeDays: 270, sqftTolerancePct: 0.25, batchSize: 12 },
  { key: "tier_4", maxMiles: 3.0, maxSoldAgeDays: 365, sqftTolerancePct: 0.3, batchSize: 16 },
];

function normType(t: string | null | undefined) {
  return String(t ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

export function isValidSoldComparable(
  subject: SubjectLookupResult,
  comp: NearbyCompCandidate,
  tier: CompSearchTier
) {
  if (!comp.soldPrice || comp.soldPrice <= 0) return { valid: false as const, reason: "no_sale_price" };
  if (!comp.soldDate) return { valid: false as const, reason: "no_sale_date" };
  if (daysSince(comp.soldDate) > tier.maxSoldAgeDays) return { valid: false as const, reason: "sale_too_old" };

  if (subject.propertyType && comp.propertyType) {
    const a = normType(subject.propertyType);
    const b = normType(comp.propertyType);
    if (a && b && a !== b) return { valid: false as const, reason: "property_type_mismatch" };
  }

  const miles = comp.distanceMiles ?? milesBetween(subject.lat, subject.lng, comp.lat, comp.lng);
  if (typeof miles === "number" && miles > tier.maxMiles) return { valid: false as const, reason: "too_far" };

  if (subject.sqft && comp.sqft) {
    const diffPct = Math.abs(subject.sqft - comp.sqft) / Math.max(subject.sqft, 1);
    if (diffPct > tier.sqftTolerancePct) return { valid: false as const, reason: "sqft_too_different" };
  }

  return { valid: true as const, reason: null };
}

export async function searchWarehouseNeighborCandidates(subject: SubjectLookupResult, maxRows = 300) {
  if (!subject.subjectId) return [];

  const zip = String(subject.zipCode ?? "").trim();

  let rows: PropertyRow[];
  if (zip) {
    const { data, error } = await supabaseServer
      .from("properties_warehouse")
      .select("*")
      .eq("zip_code", zip)
      .neq("id", subject.subjectId)
      .limit(maxRows);
    if (error) throw error;
    rows = (data ?? []) as PropertyRow[];
  } else if (subject.lat != null && subject.lng != null) {
    rows = await loadWarehousePropertiesNearSubject(
      {
        id: subject.subjectId,
        lat: subject.lat,
        lng: subject.lng,
      },
      5,
      maxRows
    );
  } else {
    rows = [];
  }

  return rows.map((row) => ({
    externalId: row.id,
    address: row.address,
    city: row.city,
    state: row.state,
    zipCode: row.zip_code,
    lat: row.lat,
    lng: row.lng,
    propertyType: row.property_type,
    beds: row.beds,
    baths: row.baths,
    sqft: row.sqft,
    yearBuilt: row.year_built,
    distanceMiles: milesBetween(subject.lat, subject.lng, row.lat, row.lng),
  })) as NearbyCompCandidate[];
}

export async function attachWarehouseSoldSnapshot(
  candidate: NearbyCompCandidate
): Promise<NearbyCompCandidate | null> {
  if (!candidate.externalId) return null;
  const history = await getPropertyHistory(candidate.externalId, 40);
  const { soldPrice, soldDate } = extractCompSaleFromHistory(history);
  if (!soldPrice || soldPrice <= 0) return null;
  return {
    ...candidate,
    soldPrice,
    soldDate,
    listingStatus: "sold",
  };
}

export function similarityRank(subject: SubjectLookupResult, candidate: NearbyCompCandidate) {
  let score = 100;
  if (subject.beds != null && candidate.beds != null) {
    score -= Math.min(Math.abs(subject.beds - candidate.beds) * 5, 15);
  }
  if (subject.baths != null && candidate.baths != null) {
    score -= Math.min(Math.abs(subject.baths - candidate.baths) * 4, 12);
  }
  if (subject.sqft && candidate.sqft) {
    score -= Math.min(Math.abs(subject.sqft - candidate.sqft) / 50, 20);
  }
  if (typeof candidate.distanceMiles === "number") {
    score -= Math.min(candidate.distanceMiles * 10, 25);
  }
  return Math.max(1, score);
}
