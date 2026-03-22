/**
 * Accepts flat {@link HomeValueEstimateRequest} or nested V2 body from API spec.
 */
import type { HomeValueEstimateRequest, PropertyCondition, RenovationLevel } from "./types";

function num(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function asCondition(v: unknown): PropertyCondition | undefined {
  if (v === "poor" || v === "fair" || v === "average" || v === "good" || v === "excellent") return v;
  return undefined;
}

function renovatedToRenovation(renovatedRecently: unknown): RenovationLevel | undefined {
  if (renovatedRecently === true) return "cosmetic";
  if (renovatedRecently === false) return "none";
  return undefined;
}

/**
 * Detects nested `{ address, details?, context? }` and maps to the pipeline request shape.
 */
export function normalizeHomeValueEstimateRequestBody(raw: unknown): HomeValueEstimateRequest {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid JSON body");
  }
  const o = raw as Record<string, unknown>;

  if (o.address != null && typeof o.address === "object" && !Array.isArray(o.address)) {
    const a = o.address as Record<string, unknown>;
    const d = (o.details && typeof o.details === "object" ? o.details : {}) as Record<string, unknown>;
    const ctx = (o.context && typeof o.context === "object" ? o.context : {}) as Record<string, unknown>;

    const full =
      String(a.fullAddress ?? a.full_address ?? "").trim() ||
      [a.line1, a.city, a.state, a.zip].filter(Boolean).join(", ");

    const sessionRaw = ctx.sessionId ?? ctx.session_id;

    const out: HomeValueEstimateRequest = {
      address: full,
      city: a.city != null ? String(a.city) : null,
      state: a.state != null ? String(a.state) : null,
      zip: a.zip != null ? String(a.zip) : null,
      lat: num(a.lat),
      lng: num(a.lng),
      beds: num(d.beds),
      baths: num(d.baths),
      sqft: num(d.sqft),
      lotSqft: num(d.lotSqft ?? d.lot_sqft),
      yearBuilt: num(d.yearBuilt ?? d.year_built),
      propertyType: d.propertyType != null ? String(d.propertyType) : d.property_type != null ? String(d.property_type) : null,
      condition: asCondition(d.condition) ?? "average",
      renovation: renovatedToRenovation(d.renovatedRecently ?? d.renovated_recently) ?? "none",
      session_id: sessionRaw != null ? String(sessionRaw) : undefined,
      intent_signals: { homeValueUsed: true },
    };

    return out;
  }

  return o as HomeValueEstimateRequest;
}
