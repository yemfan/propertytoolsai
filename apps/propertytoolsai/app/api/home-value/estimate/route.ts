import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { forwardGeocodeAddress } from "@/lib/homeValue/forwardGeocodeAddress";
import { normalizeHomeValueEstimateRequestBody } from "@/lib/homeValue/normalizeEstimateRequestBody";
import { runHomeValueEstimatePipeline } from "@/lib/homeValue/runEstimate";
import { getComparables } from "@/lib/propertyService";

function addressLineForGeocode(address: string, city: string | null, state: string | null, zip: string | null) {
  return [address, city, state, zip]
    .filter((x) => x != null && String(x).trim())
    .map((x) => String(x).trim())
    .join(", ");
}

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => ({}));
    const body = normalizeHomeValueEstimateRequestBody(raw);
    const authUser = await getUserFromRequest(req);
    const userId = authUser?.id ?? null;

    const result = await runHomeValueEstimatePipeline(body, { userId });
    const normalized = result.normalizedProperty;
    let lat = normalized.lat != null ? Number(normalized.lat) : NaN;
    let lng = normalized.lng != null ? Number(normalized.lng) : NaN;

    if (!normalized.address) {
      return NextResponse.json(
        { success: false, error: "Missing property address" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      const query = addressLineForGeocode(
        normalized.address,
        normalized.city,
        normalized.state,
        normalized.zip
      );
      const geo = query ? await forwardGeocodeAddress(query) : null;
      if (geo) {
        lat = geo.lat;
        lng = geo.lng;
      }
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json(
        { success: false, error: "Missing property coordinates" },
        { status: 400 }
      );
    }

    let comps: Awaited<ReturnType<typeof getComparables>>["comps"] = [];
    try {
      const result2 = await getComparables(normalized.address, 12);
      comps = result2.comps;
      console.log(
        `[home-value-estimate] getComparables for "${normalized.address}": ` +
        `subject=${result2.subject ? "found" : "NOT FOUND"}, ` +
        `comps=${comps.length}`
      );
    } catch (compErr) {
      console.error("[home-value-estimate] getComparables THREW:", compErr);
    }
    const compsMapped = (comps ?? []).map((comp) => {
      const soldPrice = comp.sold_price != null ? Number(comp.sold_price) : 0;
      const soldDate = comp.sold_date ? String(comp.sold_date) : "";
      const sqft =
        comp.comp_property?.sqft != null ? Number(comp.comp_property.sqft) : undefined;
      const beds =
        comp.comp_property?.beds != null ? Number(comp.comp_property.beds) : undefined;
      const baths =
        comp.comp_property?.baths != null ? Number(comp.comp_property.baths) : undefined;
      const latVal =
        comp.comp_property?.lat != null ? Number(comp.comp_property.lat) : undefined;
      const lngVal =
        comp.comp_property?.lng != null ? Number(comp.comp_property.lng) : undefined;
      const ppsf = sqft && soldPrice > 0 ? soldPrice / sqft : undefined;

      return {
        id: String(comp.id),
        address: String(comp.comp_property?.address ?? "Comparable property"),
        soldPrice,
        soldDate,
        pricePerSqft: ppsf,
        sqft,
        beds,
        baths,
        distanceMiles: Number(comp.distance_miles ?? 0),
        similarityScore: Number(comp.similarity_score ?? 0),
        matchReasons: [],
        lat: latVal,
        lng: lngVal,
      };
    });

    return NextResponse.json({
      success: true,
      sessionId: result.sessionId,
      property: {
        fullAddress: normalized.address,
        city: normalized.city ?? undefined,
        state: normalized.state ?? undefined,
        zip: normalized.zip ?? undefined,
        lat,
        lng,
        propertyType: normalized.propertyType ?? undefined,
        beds: normalized.beds ?? undefined,
        baths: normalized.baths ?? undefined,
        sqft: normalized.sqft ?? undefined,
        yearBuilt: normalized.yearBuilt ?? undefined,
        lotSize: normalized.lotSqft ?? undefined,
      },
      estimate: {
        value: result.estimate.point,
        rangeLow: result.estimate.low,
        rangeHigh: result.estimate.high,
        confidence: result.confidence.level,
        confidenceScore: result.confidence.score,
        summary: result.estimate.summary,
      },
      supportingData: {
        medianPpsf: result.market.pricePerSqft ?? result.estimate.baselinePpsf,
        weightedPpsf: result.estimate.baselinePpsf,
        compCount: result.comps.pricedCount,
      },
      adjustments: {},
      comps: compsMapped,
      recommendations: {
        type: result.intentInference.applied,
        actions: result.recommendations.map((x) => x.title),
      },
      provider: {
        source: result.market.source ?? "pipeline",
        cached: false,
      },
      _debug: {
        pipelinePricedCount: result.comps.pricedCount,
        pipelineTotalConsidered: result.comps.totalConsidered,
        getComparablesReturned: compsMapped.length,
        normalizedAddress: normalized.address,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    if (msg === "address is required") {
      return NextResponse.json({ success: false, error: msg }, { status: 400 });
    }
    console.error("home-value-estimate", e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
