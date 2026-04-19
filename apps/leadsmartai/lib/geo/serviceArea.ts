/**
 * Shared types + helpers for the structured service-area picker.
 *
 * An `AgentServiceArea` is one entry in the agent's `service_areas_v2`
 * jsonb column. `city === null` means "all cities in this county".
 */

export type AgentServiceArea = {
  state: string; // 2-letter USPS code (e.g. "CA")
  county: string; // county name without suffix (e.g. "Los Angeles")
  city: string | null; // city name, or null for county-wide coverage
};

/** Stable string tag for UI display + dedupe. */
export function serviceAreaLabel(a: AgentServiceArea): string {
  if (a.city) return `${a.city}, ${a.state}`;
  return `All of ${a.county} County, ${a.state}`;
}

/** Dedupe key — same state+county+city (nulls normalized) collide. */
export function serviceAreaKey(a: AgentServiceArea): string {
  return `${a.state.toUpperCase()}|${a.county.toLowerCase()}|${(a.city ?? "*").toLowerCase()}`;
}

/**
 * Legacy format: `service_areas text[]`. We keep writing to it from the
 * new picker so any call site still reading the old column continues to
 * see useful values. Format mirrors what the old picker produced: either
 * "city, state" or "all of county, state" — all lowercased.
 */
export function serviceAreaToLegacyString(a: AgentServiceArea): string {
  return serviceAreaLabel(a).toLowerCase();
}

export function serviceAreasToLegacyStrings(
  areas: readonly AgentServiceArea[],
): string[] {
  return areas.map(serviceAreaToLegacyString);
}

/** Type guard for runtime validation of DB rows / request bodies. */
export function isValidServiceArea(v: unknown): v is AgentServiceArea {
  if (v == null || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (typeof o.state !== "string" || o.state.length !== 2) return false;
  if (typeof o.county !== "string" || o.county.trim().length === 0) return false;
  if (o.city !== null && (typeof o.city !== "string" || o.city.trim().length === 0)) {
    return false;
  }
  return true;
}

export function parseServiceAreas(raw: unknown): AgentServiceArea[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isValidServiceArea);
}
