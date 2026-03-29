import type { PropertyRow } from "@/lib/propertyService";
import type { EstimateInput, LikelyIntent, PropertyType } from "./estimate";

function median(nums: number[]): number | undefined {
  const a = nums.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
  if (a.length === 0) return undefined;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid]! : (a[mid - 1]! + a[mid]!) / 2;
}

/** Map MLS / warehouse strings to engine property types. */
export function mapPropertyType(raw: string | null | undefined): PropertyType | undefined {
  if (!raw) return undefined;
  const s = raw.toLowerCase();
  if (s.includes("condo")) return "condo";
  if (s.includes("town")) return "townhome";
  if (
    s.includes("multi") ||
    s.includes("duplex") ||
    s.includes("triplex") ||
    s.includes("fourplex") ||
    /\b2-4\b/.test(s)
  ) {
    return "multi_family";
  }
  return "single_family";
}

export type PricedComp = {
  soldPrice: number;
  sqft: number;
  pricePerSqft: number;
  compProperty?: PropertyRow;
};

/**
 * Build {@link EstimateInput} from warehouse subject + comparable sales.
 * Uses median $/sqft and median sold price from comps; typical beds/baths/lot from comp medians.
 */
export function buildEstimateInputFromPropertyAndComps(params: {
  /** User-facing address line (preferred for summaries). */
  displayAddress: string;
  property: PropertyRow;
  pricedComps: PricedComp[];
  yoyTrendPct?: number;
  avgDaysOnMarket?: number;
  marketVolatilityScore?: number;
  likelyIntent?: LikelyIntent;
  source?: string;
}): EstimateInput {
  const { displayAddress, property, pricedComps } = params;

  const ppsfList = pricedComps.map((c) => c.pricePerSqft);
  const medianPpsf = median(ppsfList) ?? 0;

  const salePrices = pricedComps.map((c) => c.soldPrice);
  const medianPrice = median(salePrices);

  const bedsList = pricedComps
    .map((c) => c.compProperty?.beds)
    .filter((b): b is number => b != null && Number.isFinite(Number(b)))
    .map(Number);
  const bathsList = pricedComps
    .map((c) => c.compProperty?.baths)
    .filter((b): b is number => b != null && Number.isFinite(Number(b)))
    .map(Number);
  const lotsList = pricedComps
    .map((c) => c.compProperty?.lot_size)
    .filter((l): l is number => l != null && Number.isFinite(Number(l)) && Number(l) > 0)
    .map(Number);

  const subjectSqft =
    Number(property.sqft ?? 0) > 0
      ? Number(property.sqft)
      : pricedComps[0]?.sqft ?? 0;

  return {
    address: {
      fullAddress: displayAddress.trim() || property.address,
      city: (property.city ?? "").trim(),
      state: (property.state ?? "").trim(),
      zip: (property.zip_code ?? "").trim(),
    },
    details: {
      propertyType: mapPropertyType(property.property_type),
      beds: property.beds ?? undefined,
      baths: property.baths ?? undefined,
      sqft: subjectSqft || undefined,
      yearBuilt: property.year_built ?? undefined,
      lotSize: property.lot_size ?? undefined,
    },
    market: {
      medianPpsf,
      medianPrice,
      yoyTrendPct: params.yoyTrendPct,
      avgDaysOnMarket: params.avgDaysOnMarket,
      compCount: pricedComps.length,
      typicalBeds: median(bedsList),
      typicalBaths: median(bathsList),
      typicalLotSize: median(lotsList),
      marketVolatilityScore: params.marketVolatilityScore,
    },
    context: {
      likelyIntent: params.likelyIntent,
      source: params.source,
    },
  };
}
