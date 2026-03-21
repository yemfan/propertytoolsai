import {
  getComparables,
  getLatestSnapshot,
  getPropertyByAddress,
} from "@/lib/propertyService";

export type OpenHouseReportData = {
  property: {
    address: string;
    city: string | null;
    state: string | null;
    beds: number | null;
    baths: number | null;
    sqft: number | null;
    propertyType: string | null;
    yearBuilt: number | null;
  };
  estimated: {
    estimatedValue: number | null;
    low: number | null;
    high: number | null;
    avgPricePerSqft: number | null;
    summary: string;
  };
  rent: {
    rentEstimate: number | null;
  };
  comps: Array<{
    address: string;
    price: number;
    sqft: number;
    pricePerSqft: number;
    distanceMiles: number;
    soldDate: string;
    beds: number | null;
    baths: number | null;
    propertyType: string | null;
  }>;
  generated_at: string;
};

function formatSoldDate(soldDate: string | null | undefined) {
  if (!soldDate) return "—";
  const d = new Date(soldDate);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString() : "—";
}

export async function generateOpenHouseReportData(params: {
  propertyId: string;
  address: string;
}): Promise<OpenHouseReportData> {
  const { propertyId, address } = params;

  // Ensure the warehouse ingestion exists (snapshots/comps) before building the report.
  const subject = await getPropertyByAddress(address);
  if (!subject) {
    throw new Error("Property not found in warehouse after ingestion.");
  }

  const latestSnapshot = await getLatestSnapshot(propertyId);
  const compsResult = await getComparables(address, 10);

  const soldComps = (compsResult.comps ?? []).map((c) => {
    const compProp = c.comp_property;
    const sqft = Number(compProp?.sqft ?? 0);
    const price = c.sold_price != null ? Number(c.sold_price) : null;
    const soldDate = formatSoldDate(c.sold_date);

    if (!isFinite(price as number) || !isFinite(sqft) || sqft <= 0) return null;

    return {
      address: compProp?.address ?? "—",
      price: Number(price),
      sqft,
      pricePerSqft: price! / sqft,
      distanceMiles: Number(c.distance_miles ?? 0),
      soldDate,
      beds: compProp?.beds ?? null,
      baths: compProp?.baths ?? null,
      propertyType: compProp?.property_type ?? null,
    };
  }).filter(Boolean) as NonNullable<
    Awaited<ReturnType<typeof generateOpenHouseReportData>>["comps"][number]
  >[];

  const avgPricePerSqft =
    soldComps.length > 0
      ? soldComps.reduce((sum, c) => sum + c.pricePerSqft, 0) / soldComps.length
      : null;

  const subjectSqft = Number(subject.sqft ?? 0) || null;

  const estimatedValue =
    avgPricePerSqft != null && subjectSqft != null
      ? avgPricePerSqft * subjectSqft
      : latestSnapshot?.estimated_value != null
        ? Number(latestSnapshot.estimated_value)
        : null;

  const low = estimatedValue != null ? estimatedValue * 0.92 : null;
  const high = estimatedValue != null ? estimatedValue * 1.08 : null;

  // Create a summary similar to your Home Value / Smart CMA pages.
  const summary =
    soldComps.length > 0 && avgPricePerSqft != null && subjectSqft != null
      ? `Based on ${soldComps.length} nearby comparable sold properties, the average price/sqft is about $${avgPricePerSqft.toFixed(
          0
        )}. Using your subject’s square footage, the estimated value is approximately $${Math.round(
          estimatedValue ?? 0
        ).toLocaleString()} with an expected range of $${Math.round(
          low ?? 0
        ).toLocaleString()} to $${Math.round(high ?? 0).toLocaleString()}.`
      : `We couldn’t find enough comparable sold history for this address yet. Import an MLS CSV (sold prices + sale dates) or try a Zillow/Redfin link to populate comparables.`;

  const rentEstimate =
    latestSnapshot?.rent_estimate != null
      ? Number(latestSnapshot.rent_estimate)
      : null;

  return {
    property: {
      address: subject.address,
      city: subject.city,
      state: subject.state,
      beds: subject.beds,
      baths: subject.baths,
      sqft: subject.sqft,
      propertyType: subject.property_type,
      yearBuilt: subject.year_built,
    },
    estimated: {
      estimatedValue,
      low,
      high,
      avgPricePerSqft,
      summary,
    },
    rent: {
      rentEstimate,
    },
    comps: soldComps,
    generated_at: new Date().toISOString(),
  };
}

