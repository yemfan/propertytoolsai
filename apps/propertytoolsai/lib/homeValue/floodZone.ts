/**
 * FEMA Flood Zone lookup via the National Flood Hazard Layer (NFHL) API.
 * Free, no API key required. Uses ESRI ArcGIS REST endpoint.
 *
 * @see https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer
 */

const FEMA_NFHL_URL =
  "https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/28/query";

export type FloodZoneResult = {
  zone: string | null;
  /** true if high-risk (Zone A, AE, AH, AO, V, VE) */
  highRisk: boolean;
  /** true if moderate risk (Zone B / X-shaded) */
  moderateRisk: boolean;
};

const HIGH_RISK_ZONES = new Set(["A", "AE", "AH", "AO", "AR", "A99", "V", "VE"]);
const MODERATE_RISK_ZONES = new Set(["B", "X"]);

/**
 * Query FEMA NFHL for the flood zone at a given lat/lng.
 * Returns null zone on failure (treated as no-risk for multiplier).
 */
export async function fetchFloodZone(
  lat: number,
  lng: number
): Promise<FloodZoneResult> {
  try {
    const params = new URLSearchParams({
      geometry: `${lng},${lat}`,
      geometryType: "esriGeometryPoint",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "FLD_ZONE,ZONE_SUBTY",
      returnGeometry: "false",
      f: "json",
      inSR: "4326",
    });

    const res = await fetch(`${FEMA_NFHL_URL}?${params}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { zone: null, highRisk: false, moderateRisk: false };

    const data = await res.json();
    const features = data.features;
    if (!Array.isArray(features) || features.length === 0) {
      return { zone: null, highRisk: false, moderateRisk: false };
    }

    const zone = String(features[0].attributes?.FLD_ZONE ?? "").trim().toUpperCase();
    if (!zone) return { zone: null, highRisk: false, moderateRisk: false };

    return {
      zone,
      highRisk: HIGH_RISK_ZONES.has(zone),
      moderateRisk: MODERATE_RISK_ZONES.has(zone) && !HIGH_RISK_ZONES.has(zone),
    };
  } catch (e) {
    console.error("[floodZone] FEMA NFHL query failed:", e);
    return { zone: null, highRisk: false, moderateRisk: false };
  }
}

/**
 * Flood zone → property value multiplier.
 * Properties in high-risk flood zones (A/V) sell 5-7% less.
 * Moderate-risk zones see ~2% discount.
 */
export function floodZoneMultiplier(
  result: FloodZoneResult
): { m: number; label: string } {
  if (result.zone == null) {
    return { m: 1, label: "Flood zone (not available)" };
  }
  if (result.highRisk) {
    return { m: 0.94, label: `Flood zone ${result.zone} (high risk)` };
  }
  if (result.moderateRisk) {
    return { m: 0.98, label: `Flood zone ${result.zone} (moderate risk)` };
  }
  return { m: 1.0, label: `Flood zone ${result.zone} (minimal risk)` };
}
