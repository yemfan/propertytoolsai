import type {
  PropertyTypeFilter,
  SavedSearchCriteria,
} from "@/lib/contacts/types";

/**
 * Bridge between the IDX public-site filter shape and the internal
 * `SavedSearchCriteria` shape used by the saved-search digest cron. They are
 * mostly aligned, but the IDX `IdxPropertyType` enum has `land` and `other`
 * which are not part of the (consumer-facing) saved-search alert types — those
 * map to "any" so the alert never returns zero matches by accident.
 */
function mapPropertyType(idxType: unknown): PropertyTypeFilter | undefined {
  if (typeof idxType !== "string") return undefined;
  switch (idxType) {
    case "single_family":
    case "condo":
    case "townhouse":
    case "multi_family":
      return idxType;
    case "land":
    case "other":
      return "any";
    default:
      return undefined;
  }
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function asString(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s ? s : undefined;
}

export function idxFiltersToSavedSearchCriteria(
  filters: Record<string, unknown> | null | undefined,
): SavedSearchCriteria {
  if (!filters) return {};
  const out: SavedSearchCriteria = {};
  const city = asString(filters.city);
  if (city) out.city = city;
  const state = asString(filters.state);
  if (state) out.state = state;
  const zip = asString(filters.zip);
  if (zip) out.zip = zip;
  const propertyType = mapPropertyType(filters.propertyType);
  if (propertyType) out.propertyType = propertyType;
  const priceMin = asNumber(filters.priceMin);
  if (priceMin !== undefined) out.priceMin = priceMin;
  const priceMax = asNumber(filters.priceMax);
  if (priceMax !== undefined) out.priceMax = priceMax;
  const bedsMin = asNumber(filters.bedsMin);
  if (bedsMin !== undefined) out.bedsMin = bedsMin;
  const bathsMin = asNumber(filters.bathsMin);
  if (bathsMin !== undefined) out.bathsMin = bathsMin;
  const sqftMin = asNumber(filters.sqftMin);
  if (sqftMin !== undefined) out.sqftMin = sqftMin;
  return out;
}

/**
 * Generate a human-readable name for a saved search based on its criteria.
 * Names appear in the agent CRM ("Sarah's saved searches") and in the daily
 * digest emails ("New matches for: Homes in Austin, TX under $800,000").
 *
 * Capped at 120 chars to match the column constraint in `createSavedSearch`.
 */
export function buildSavedSearchName(criteria: SavedSearchCriteria): string {
  const place =
    criteria.city && criteria.state
      ? `${criteria.city}, ${criteria.state}`
      : criteria.city ?? criteria.state ?? criteria.zip ?? "your area";

  const parts: string[] = [`Homes in ${place}`];

  if (criteria.priceMax) {
    parts.push(`under $${criteria.priceMax.toLocaleString()}`);
  } else if (criteria.priceMin) {
    parts.push(`over $${criteria.priceMin.toLocaleString()}`);
  }

  if (criteria.bedsMin) {
    parts.push(`${criteria.bedsMin}+ beds`);
  }

  if (criteria.propertyType && criteria.propertyType !== "any") {
    parts.push(criteria.propertyType.replace("_", " "));
  }

  return parts.join(" · ").slice(0, 120);
}
