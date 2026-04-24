import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { PropertyIneligibleError } from "@/lib/homeValue/eligibility";
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
        {
          success: false,
          status: "ineligible",
          reason: "ADDRESS_NOT_FOUND",
          message:
            "We couldn't locate this address. Check the spelling, or try including the city, state, and ZIP.",
        },
        { status: 400 }
      );
    }

    /**
     * The eligibility gate itself lives in the pipeline
     * (runHomeValueEstimatePipeline throws PropertyIneligibleError as
     * soon as enrichment completes, before any expensive fetches).
     * We catch it in the outer try/catch below and map it to the
     * ineligible response envelope.
     */

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

    /**
     * Fall back to Rentcast pipeline comps when the local warehouse
     * returned zero comps. Rentcast comps come with lat/lng from
     * the API so they're more map-friendly.
     */
    if (compsMapped.length === 0 && result.rentcastComps.length > 0) {
      console.log(`[home-value-estimate] Warehouse returned 0 comps — falling back to ${result.rentcastComps.length} Rentcast comps`);
      for (const rc of result.rentcastComps) {
        compsMapped.push({
          id: rc.id,
          address: rc.address,
          soldPrice: rc.soldPrice,
          soldDate: rc.soldDate,
          pricePerSqft: rc.pricePerSqft,
          sqft: rc.sqft,
          beds: rc.beds,
          baths: rc.baths,
          distanceMiles: rc.distanceMiles ?? 0,
          similarityScore: 0,
          matchReasons: [],
          lat: rc.lat,
          lng: rc.lng,
        });
      }
    }

    /**
     * Geocode comps that lack lat/lng so they show on the map.
     * Many warehouse property records don't have coordinates.
     * Batch-geocode up to 10 comps in parallel (Mapbox free tier
     * allows 100K requests/month, so this is fine).
     */
    const compsToGeocode = compsMapped.filter(
      (c) => typeof c.lat !== "number" || typeof c.lng !== "number" || !Number.isFinite(c.lat) || !Number.isFinite(c.lng)
    );
    if (compsToGeocode.length > 0) {
      // Build geocode queries with city/state/zip context for better hit rate
      const subjectCity = normalized.city;
      const subjectState = normalized.state;
      const subjectZip = normalized.zip;
      const geocodeResults = await Promise.allSettled(
        compsToGeocode.slice(0, 10).map(async (comp) => {
          const query = addressLineForGeocode(comp.address, subjectCity, subjectState, subjectZip);
          const geo = query ? await forwardGeocodeAddress(query) : null;
          if (geo) {
            comp.lat = geo.lat;
            comp.lng = geo.lng;
          }
        })
      );
      const geocoded = geocodeResults.filter((r) => r.status === "fulfilled").length;
      console.log(`[home-value-estimate] Geocoded ${geocoded}/${compsToGeocode.length} comps (with city/state context)`);
    }

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
        // `market.pricePerSqft` is a ZIP-wide median from market_snapshots
        // that mixes ALL property types (SFR + condos + townhomes + multi-
        // family). In mixed markets like Monterey Park / SGV that number
        // can be half the SFR median because condos drag it down. The
        // estimate internally uses `estimate.baselinePpsf` — the weighted
        // median of the N comps actually returned for THIS subject, which
        // is both more subject-specific and consistent with the displayed
        // estimated value. Prefer baselinePpsf; fall back to the generic
        // ZIP median only when there are no comps (baselinePpsf = 0).
        medianPpsf:
          result.estimate.baselinePpsf && result.estimate.baselinePpsf > 0
            ? result.estimate.baselinePpsf
            : result.market.pricePerSqft,
        weightedPpsf: result.estimate.baselinePpsf,
        compCount: result.comps.pricedCount,
      },
      adjustments: (() => {
        // Convert engine multiplier adjustments to dollar-value adjustments for the UI.
        // Each multiplier is relative to 1.0 (neutral), so the dollar impact is:
        //   (multiplier - 1) × estimateValue
        const ev = result.estimate.point;
        const adj: Record<string, number> = {};
        for (const line of result.estimate.adjustments) {
          const dollarImpact = Math.round((line.multiplier - 1) * ev);
          if (dollarImpact !== 0) {
            adj[line.key + "Adjustment"] = dollarImpact;
          }
        }
        return adj;
      })(),
      comps: compsMapped,
      recommendations: {
        type: result.intentInference.applied,
        // Preserve href + reason so the client can render clickable
        // CTAs. Previously this was `.map((x) => x.title)` which
        // threw away the destination and left the Next Steps cards
        // as inert blocks.
        actions: result.recommendations.map((x) => ({
          title: x.title,
          href: x.href,
          reason: x.reason,
        })),
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
    /**
     * Pipeline short-circuited because the address is not eligible
     * for a valuation (non-residential, insufficient data, etc.).
     * Map to the ineligible response envelope with a 200 status —
     * it's not a server error, it's a deliberate outcome.
     */
    if (e instanceof PropertyIneligibleError) {
      return NextResponse.json(
        {
          success: false,
          status: "ineligible",
          reason: e.reason,
          message: e.message,
          detail: e.detail,
          detectedType: e.detectedType,
        },
        { status: 200 }
      );
    }
    const msg = e instanceof Error ? e.message : "Server error";
    if (msg === "address is required") {
      return NextResponse.json({ success: false, error: msg }, { status: 400 });
    }
    console.error("home-value-estimate", e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
