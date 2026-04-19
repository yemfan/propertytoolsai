/**
 * Home Value Estimate — eligibility gate.
 *
 * Decides whether a given address should get a dollar estimate at all.
 * Runs AFTER geocoding + warehouse/Rentcast enrichment and BEFORE the
 * estimate pipeline produces a number. If the address is ineligible
 * (non-residential, no property record, all-default attributes, etc.)
 * we short-circuit and return an "ineligible" response instead of a
 * fake-looking dollar value.
 *
 * Background: prior to this gate, an address like 111 N Hill St, Los
 * Angeles (a civic/government address near the LA courthouse) would
 * silently fall back to DEFAULT_SQFT / DEFAULT_BEDS / DEFAULT_BATHS
 * and produce a ~$2.9M "estimate" that looks authoritative but is
 * meaningless. This module closes that gap.
 */

import type { NormalizedProperty } from "./types";

export type IneligibleReason =
  | "ADDRESS_NOT_FOUND"
  | "NON_RESIDENTIAL"
  | "INSUFFICIENT_DATA"
  | "AMBIGUOUS_TYPE";

export type EligibilityResult =
  | { eligible: true }
  | {
      eligible: false;
      reason: IneligibleReason;
      /** Human-readable explanation safe to render in the UI. */
      message: string;
      /** Optional machine-readable detail for logging/analytics. */
      detail?: string;
      /** Type we detected (if any) — useful for the UI banner. */
      detectedType?: string;
    };

/**
 * Thrown by the estimate pipeline when it determines the address is
 * not eligible for a valuation. The API route catches this and maps
 * it to the HomeValueIneligibleResponse envelope. Using a typed error
 * (instead of a union return type) keeps the pipeline's happy-path
 * return shape unchanged while still letting us short-circuit early
 * and avoid the expensive parallel fetches (walk score, flood, schools,
 * zip market, confidence engine).
 */
export class PropertyIneligibleError extends Error {
  readonly reason: IneligibleReason;
  readonly detail?: string;
  readonly detectedType?: string;
  constructor(
    reason: IneligibleReason,
    message: string,
    opts: { detail?: string; detectedType?: string } = {}
  ) {
    super(message);
    this.name = "PropertyIneligibleError";
    this.reason = reason;
    this.detail = opts.detail;
    this.detectedType = opts.detectedType;
  }
}

/**
 * Allowed property types for valuation.
 *
 * We normalize loosely (strip spaces/hyphens, lowercase) before matching
 * because Rentcast/county/warehouse sources use inconsistent casing
 * ("Single Family", "single-family", "SingleFamily", "SFR").
 */
const RESIDENTIAL_TYPES = new Set([
  "singlefamily",
  "sfr",
  "singlefamilyresidence",
  "condo",
  "condominium",
  "townhome",
  "townhouse",
  "rowhouse",
  "multifamily",
  "duplex",
  "triplex",
  "fourplex",
  "apartment",
  "manufactured",
  "mobilehome",
  "coop",
  "cooperative",
]);

/**
 * Known non-residential classifications. If a source returns one of these
 * we fail fast with NON_RESIDENTIAL rather than trying to coerce it into
 * an SFR estimate.
 */
const NON_RESIDENTIAL_TYPES = new Set([
  "commercial",
  "retail",
  "office",
  "industrial",
  "warehouse",
  "hotel",
  "motel",
  "government",
  "civic",
  "institutional",
  "school",
  "church",
  "religious",
  "hospital",
  "medical",
  "vacantland",
  "vacantlot",
  "land",
  "agricultural",
  "farm",
  "parking",
  "utility",
  "mixeduse",
]);

function canonicalize(type: string | null | undefined): string {
  if (!type) return "";
  return type.toLowerCase().replace(/[\s_\-]/g, "").trim();
}

/**
 * Sentinel/placeholder sqft values seen in upstream data.
 *   9999: common "no data" placeholder from legacy county feeds.
 *   0, negative, non-finite: obviously invalid.
 *   >50000: almost always junk for a residential parcel.
 */
function looksLikePlaceholderSqft(sqft: number | null | undefined): boolean {
  if (sqft == null) return true;
  if (!Number.isFinite(sqft)) return true;
  if (sqft <= 0) return true;
  if (sqft === 9999) return true;
  if (sqft > 50_000) return true;
  return false;
}

/**
 * Determine eligibility for a valuation.
 *
 * @param merged  Normalized property after enrichment (warehouse + Rentcast + body).
 * @param opts.hasWarehouseRow  True if we found a row in our warehouse.
 * @param opts.hasRentcastSubject  True if Rentcast /v1/properties returned a record.
 * @param opts.userProvidedCoreFacts  True if the user explicitly typed beds/baths/sqft.
 *        When the user provides their own facts we trust them and skip the
 *        "all defaults" check — they know their home better than our data sources.
 */
export function checkPropertyEligibility(
  merged: NormalizedProperty,
  opts: {
    hasWarehouseRow: boolean;
    hasRentcastSubject: boolean;
    userProvidedCoreFacts: boolean;
  }
): EligibilityResult {
  // 1) Non-residential property type → fail fast.
  const canon = canonicalize(merged.propertyType);
  if (canon && NON_RESIDENTIAL_TYPES.has(canon)) {
    return {
      eligible: false,
      reason: "NON_RESIDENTIAL",
      message:
        "This address doesn't appear to be a residential property. Our valuation model only supports homes — single family, condo, townhome, and multi-family.",
      detail: `propertyType=${merged.propertyType}`,
      detectedType: merged.propertyType ?? undefined,
    };
  }

  // 2) No record in warehouse AND no Rentcast subject AND user didn't type
  //    their own facts → we have nothing to value. Returning defaults here
  //    is how we ended up with $2.9M estimates for parking lots.
  if (
    !opts.hasWarehouseRow &&
    !opts.hasRentcastSubject &&
    !opts.userProvidedCoreFacts
  ) {
    return {
      eligible: false,
      reason: "INSUFFICIENT_DATA",
      message:
        "We couldn't find property records for this address. It may be a new build, vacant lot, or a non-residential parcel. Try adjusting the address, or enter the home details manually.",
      detail: "no warehouse row, no rentcast subject, no user facts",
    };
  }

  // 3) We have SOME record but the core facts (beds/baths/sqft) are all
  //    missing or placeholders → estimate would be built entirely from
  //    defaults. Surface it rather than pretending.
  if (!opts.userProvidedCoreFacts) {
    const sqftBad = looksLikePlaceholderSqft(merged.sqft);
    const bedsBad = !(merged.beds != null && merged.beds > 0);
    const bathsBad = !(merged.baths != null && merged.baths > 0);
    if (sqftBad && bedsBad && bathsBad) {
      return {
        eligible: false,
        reason: "INSUFFICIENT_DATA",
        message:
          "We found this address but don't have enough property details (square footage, bedrooms, bathrooms) to produce a reliable estimate. Enter the details manually to continue.",
        detail: `sqft=${merged.sqft}, beds=${merged.beds}, baths=${merged.baths}`,
      };
    }
  }

  // 4) Known residential type → eligible.
  if (canon && RESIDENTIAL_TYPES.has(canon)) {
    return { eligible: true };
  }

  // 5) Unknown/unrecognized type (not on either list). Two sub-cases:
  //    a) user provided facts → trust them, treat as eligible
  //    b) no user facts → ambiguous; block with a clear reason
  if (canon && !RESIDENTIAL_TYPES.has(canon) && !NON_RESIDENTIAL_TYPES.has(canon)) {
    if (opts.userProvidedCoreFacts) {
      return { eligible: true };
    }
    return {
      eligible: false,
      reason: "AMBIGUOUS_TYPE",
      message:
        "We couldn't confirm this is a residential property. If it's your home, enter the details manually to get an estimate.",
      detail: `unrecognized propertyType=${merged.propertyType}`,
      detectedType: merged.propertyType ?? undefined,
    };
  }

  // 6) Empty type but we got here (so we have some data). Allow it —
  //    downstream defaults will fill in what's missing.
  return { eligible: true };
}
