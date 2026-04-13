import { randomUUID } from "crypto";
import type { ActiveListing, ComparableSale, SubjectPropertyInput, ValuationDataBundle } from "../types";
import { computeTaxAnchorEstimate } from "../taxAnchor";

function mapPropertyType(value?: string): SubjectPropertyInput["propertyType"] | undefined {
  if (!value) return undefined;
  const v = value.toLowerCase();
  if (v.includes("single")) return "single_family";
  if (v.includes("condo")) return "condo";
  if (v.includes("town")) return "townhome";
  if (v.includes("multi") || v.includes("duplex")) return "multi_family";
  return undefined;
}

function compId(row: Record<string, unknown>): string {
  const raw = row.id ?? row.propertyId ?? row.listingId;
  if (raw != null && String(raw).trim()) return String(raw);
  return randomUUID();
}

/**
 * Loads AVM + sales + active listings from Rentcast.
 * Endpoint shapes may vary by plan — adjust field mapping here only.
 */
export async function loadValuationBundleFromRentcast(subject: SubjectPropertyInput): Promise<ValuationDataBundle> {
  const apiKey = process.env.RENTCAST_API_KEY?.trim();
  if (!apiKey) throw new Error("Missing RENTCAST_API_KEY");

  const params = new URLSearchParams();
  if (subject.address) params.set("address", subject.address);
  if (subject.city) params.set("city", subject.city);
  if (subject.state) params.set("state", subject.state);
  if (subject.zip) params.set("zipCode", subject.zip);

  /**
   * Rentcast API endpoints (as of 2026):
   *
   * - `/v1/avm/value` returns the AVM estimate AND comparable
   *   sales when `compCount` is set. There is NO separate
   *   `/v1/avm/sales` endpoint — that was returning 404 and was
   *   the root cause of zero comparables being found.
   *
   * - `/v1/listings/sale` needs the address as a single string
   *   in the `address` param (city/state/zip are optional
   *   refinements, not standalone).
   *
   * - `/v1/properties` returns the property record (for tax
   *   anchor estimate).
   */
  const estimateParams = new URLSearchParams(params);
  estimateParams.set("compCount", "25");

  const headers = {
    Accept: "application/json",
    "X-Api-Key": apiKey,
  };

  const [estimateRes, activeRes, propertyRes] = await Promise.all([
    fetch(`https://api.rentcast.io/v1/avm/value?${estimateParams.toString()}`, { headers, cache: "no-store" }),
    fetch(`https://api.rentcast.io/v1/listings/sale?${params.toString()}`, { headers, cache: "no-store" }),
    fetch(`https://api.rentcast.io/v1/properties?${params.toString()}`, { headers, cache: "no-store" }),
  ]);

  console.log(
    `[rentcast] API responses for "${subject.address}": ` +
    `estimate=${estimateRes.status}, ` +
    `active=${activeRes.status}, ` +
    `property=${propertyRes.status}`
  );

  const estimateJson = estimateRes.ok ? ((await estimateRes.json()) as Record<string, unknown>) : null;
  const activeJson = activeRes.ok ? await activeRes.json() : null;
  const propertyJson = propertyRes.ok ? await propertyRes.json() : null;

  /**
   * Sale comparables come from the `/v1/avm/value` response
   * under `comparables` (array of recent nearby sales). Previous
   * code tried `/v1/avm/sales` which doesn't exist (404).
   */
  const salesRows = (() => {
    if (!estimateJson) return [];
    const compsField = estimateJson.comparables ?? estimateJson.comps ?? estimateJson.saleComparables;
    if (Array.isArray(compsField)) return compsField;
    return [];
  })();

  console.log(
    `[rentcast] Sales comps returned: ${salesRows.length} ` +
    `(estimate=${estimateJson ? "yes" : "null"}, ` +
    `property=${propertyJson ? "yes" : "null"})`
  );

  const propertyRecord = firstPropertyRecord(propertyJson);
  const taxAnchorEstimate = propertyRecord ? computeTaxAnchorEstimate(propertyRecord) : null;

  const comps: ComparableSale[] = salesRows
    .filter((row): row is Record<string, unknown> => row != null && typeof row === "object")
    .map((row) => {
      const soldPrice = Number(row.soldPrice ?? row.price ?? 0);
      const sqft = row.squareFootage != null ? Number(row.squareFootage) : undefined;
      const zipRaw =
        row.zipCode ?? row.zip ?? row.postalCode ?? row.postal_code ?? row.addressZip;
      const zipStr =
        zipRaw != null && String(zipRaw).trim() ? String(zipRaw).trim().slice(0, 10) : undefined;
      return {
        id: compId(row),
        address: String(row.formattedAddress ?? row.addressLine1 ?? "Unknown comp"),
        ...(zipStr ? { zip: zipStr } : {}),
        soldPrice,
        soldDate: String(row.soldDate ?? row.closeDate ?? row.lastSaleDate ?? new Date().toISOString()),
        beds: row.bedrooms != null ? Number(row.bedrooms) : undefined,
        baths: row.bathrooms != null ? Number(row.bathrooms) : undefined,
        sqft: Number.isFinite(sqft as number) ? sqft : undefined,
        yearBuilt: row.yearBuilt != null ? Number(row.yearBuilt) : undefined,
        distanceMiles:
          row.distance != null
            ? Number(row.distance)
            : row.distanceMiles != null
              ? Number(row.distanceMiles)
              : undefined,
        propertyType: mapPropertyType(row.propertyType != null ? String(row.propertyType) : undefined),
        pricePerSqft:
          row.pricePerSquareFoot != null
            ? Number(row.pricePerSquareFoot)
            : sqft && sqft > 0
              ? soldPrice / sqft
              : undefined,
      };
    })
    .filter((x) => x.soldPrice > 0);

  const activeRows = Array.isArray(activeJson) ? activeJson : (activeJson as { data?: unknown[] })?.data ?? [];

  const activeListings: ActiveListing[] = activeRows
    .filter((row): row is Record<string, unknown> => row != null && typeof row === "object")
    .map((row) => {
      const listPrice = Number(row.price ?? row.listPrice ?? 0);
      const sqft = row.squareFootage != null ? Number(row.squareFootage) : undefined;
      return {
        id: compId(row),
        address: String(row.formattedAddress ?? row.addressLine1 ?? "Unknown listing"),
        listPrice,
        listDate: row.listDate != null ? String(row.listDate) : row.createdDate != null ? String(row.createdDate) : undefined,
        beds: row.bedrooms != null ? Number(row.bedrooms) : undefined,
        baths: row.bathrooms != null ? Number(row.bathrooms) : undefined,
        sqft: Number.isFinite(sqft as number) ? sqft : undefined,
        pricePerSqft:
          row.pricePerSquareFoot != null
            ? Number(row.pricePerSquareFoot)
            : sqft && sqft > 0
              ? listPrice / sqft
              : undefined,
      };
    })
    .filter((x) => x.listPrice > 0);

  const apiEstimate =
    Number(estimateJson?.price ?? estimateJson?.value ?? estimateJson?.estimate ?? 0) || null;

  /**
   * Extract real property details from the /v1/properties response
   * so the pipeline can use actual sqft/beds/baths/yearBuilt
   * instead of defaults. This is the critical enrichment that was
   * missing — without it, every estimate used 1500 sqft / 3 bed /
   * 2 bath regardless of the actual property.
   */
  const subjectDetails = propertyRecord
    ? {
        sqft: propertyRecord.squareFootage != null ? Number(propertyRecord.squareFootage) : undefined,
        beds: propertyRecord.bedrooms != null ? Number(propertyRecord.bedrooms) : undefined,
        baths: propertyRecord.bathrooms != null ? Number(propertyRecord.bathrooms) : undefined,
        yearBuilt: propertyRecord.yearBuilt != null ? Number(propertyRecord.yearBuilt) : undefined,
        lotSize: propertyRecord.lotSize != null ? Number(propertyRecord.lotSize) : undefined,
        propertyType: mapPropertyType(
          propertyRecord.propertyType != null ? String(propertyRecord.propertyType) : undefined
        ),
        lastSalePrice: propertyRecord.lastSalePrice != null ? Number(propertyRecord.lastSalePrice) : undefined,
        lastSaleDate: propertyRecord.lastSaleDate != null ? String(propertyRecord.lastSaleDate) : undefined,
      }
    : undefined;

  if (subjectDetails) {
    console.log(
      `[rentcast] Property enrichment: sqft=${subjectDetails.sqft}, beds=${subjectDetails.beds}, ` +
      `baths=${subjectDetails.baths}, year=${subjectDetails.yearBuilt}, type=${subjectDetails.propertyType}`
    );
  }

  return {
    apiEstimate,
    taxAnchorEstimate,
    comps,
    activeListings,
    subjectDetails,
  };
}

function firstPropertyRecord(json: unknown): Record<string, unknown> | null {
  if (json == null) return null;
  if (Array.isArray(json)) {
    const first = json[0];
    return first && typeof first === "object" ? (first as Record<string, unknown>) : null;
  }
  if (typeof json === "object") {
    const data = (json as { data?: unknown }).data;
    if (Array.isArray(data) && data[0] && typeof data[0] === "object") {
      return data[0] as Record<string, unknown>;
    }
    if ("lastSalePrice" in (json as object) || "taxAssessments" in (json as object)) {
      return json as Record<string, unknown>;
    }
  }
  return null;
}
