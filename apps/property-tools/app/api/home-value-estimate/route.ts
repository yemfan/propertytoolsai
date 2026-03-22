import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { getPropertyData } from "@/lib/getPropertyData";
import { getPropertyByAddress, getComparables, type PropertyRow } from "@/lib/propertyService";
import { getCityData } from "@/lib/cityDataEngine";
import {
  mergeNormalizedProperty,
  computeHomeValueEstimate,
  computeConfidence,
  getToolkitRecommendations,
  DEFAULT_SQFT,
  DEFAULT_BEDS,
  DEFAULT_BATHS,
  type HomeValueEstimateRequest,
  type PropertyCondition,
  type RenovationLevel,
} from "@/lib/homeValue";
import {
  insertToolEvent,
  maybeInsertMarketSnapshot,
  upsertHomeValueSession,
} from "@/lib/homeValue/funnelPersistence";

export const runtime = "nodejs";

function trendToYoYPct(trend: "up" | "down" | "stable"): number | null {
  if (trend === "up") return 3;
  if (trend === "down") return -3;
  if (trend === "stable") return 0;
  return null;
}

/**
 * Full Home Value estimate: enrichment + estimate engine + confidence + recommendations.
 * Guests allowed (lead-gen tool); optional auth can be added later.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as HomeValueEstimateRequest;
    const addressRaw = String(body.address ?? "").trim();
    if (!addressRaw) {
      return NextResponse.json({ ok: false, error: "address is required" }, { status: 400 });
    }

    const sessionId =
      String(body.session_id ?? "").trim() || randomUUID();

    const authUser = await getUserFromRequest(req);
    const userId = authUser?.id ?? null;

    const refresh = Boolean(body.refresh);

    let row: PropertyRow | null = null;
    try {
      await getPropertyData(addressRaw, refresh);
      row = await getPropertyByAddress(addressRaw);
    } catch (e) {
      console.warn("[home-value-estimate] enrichment soft-fail", e);
      row = await getPropertyByAddress(addressRaw);
    }

    let pricedCompCount = 0;
    let totalComp = 0;
    let compPpsfAvg: number | null = null;
    try {
      const { comps } = await getComparables(addressRaw, 12);
      totalComp = comps?.length ?? 0;
      const priced = (comps ?? [])
        .map((c) => {
          const sold = c.sold_price != null ? Number(c.sold_price) : null;
          const sqft = c.comp_property?.sqft != null ? Number(c.comp_property.sqft) : null;
          if (sold == null || sqft == null || !isFinite(sold) || !isFinite(sqft) || sqft <= 0)
            return null;
          return sold / sqft;
        })
        .filter(Boolean) as number[];
      pricedCompCount = priced.length;
      if (priced.length) {
        compPpsfAvg = priced.reduce((a, b) => a + b, 0) / priced.length;
      }
    } catch {
      /* ignore */
    }

    const condition = (body.condition ?? "average") as PropertyCondition;
    const renovation = (body.renovation ?? "none") as RenovationLevel;

    const merged = mergeNormalizedProperty(addressRaw, row, body);

    const sqft = merged.sqft && merged.sqft > 0 ? merged.sqft : DEFAULT_SQFT;
    const beds = merged.beds && merged.beds > 0 ? merged.beds : DEFAULT_BEDS;
    const baths = merged.baths && merged.baths > 0 ? merged.baths : DEFAULT_BATHS;
    const propertyType = merged.propertyType || "single family";

    // Baseline PPSF: sold comps (best) → city median PPSF → static fallback
    let baselinePpsf = 245;
    let marketBlock = {
      city: merged.city || "Unknown",
      state: merged.state || "",
      trend: "stable" as "up" | "down" | "stable",
      medianPrice: null as number | null,
      pricePerSqft: null as number | null,
      source: "fallback" as string,
    };
    let daysOnMarket: number | null = null;

    if (merged.city && merged.state) {
      try {
        const city = await getCityData({
          city: merged.city,
          state: merged.state,
          maxAgeHours: 72,
        });
        daysOnMarket = city.days_on_market ?? null;
        const cityPpsf = Number(city.price_per_sqft);
        baselinePpsf =
          compPpsfAvg != null && compPpsfAvg > 0
            ? compPpsfAvg
            : cityPpsf > 0
              ? cityPpsf
              : baselinePpsf;
        marketBlock = {
          city: city.city,
          state: city.state,
          trend: city.trend,
          medianPrice: city.median_price ?? null,
          pricePerSqft: city.price_per_sqft ?? null,
          source:
            compPpsfAvg != null && compPpsfAvg > 0
              ? `${city.source ?? "city_market_data"}+comps_ppsf`
              : city.source ?? "city_market_data",
        };
      } catch (e) {
        console.warn("[home-value-estimate] getCityData failed", e);
        if (compPpsfAvg != null && compPpsfAvg > 0) {
          baselinePpsf = compPpsfAvg;
          marketBlock.source = "comps_median_ppsf";
        }
      }
    } else if (compPpsfAvg != null && compPpsfAvg > 0) {
      baselinePpsf = compPpsfAvg;
      marketBlock.source = "comps_median_ppsf";
    }

    const addressQuality =
      body.lat != null && body.lng != null
        ? "structured"
        : merged.city && merged.state
          ? "partial"
          : "unknown";

    const { confidence, rangeBandPct } = computeConfidence({
      property: merged,
      pricedCompCount,
      addressQuality,
      marketTrend: marketBlock.trend,
      daysOnMarket: null,
    });

    const estimate = computeHomeValueEstimate(
      {
        baselinePpsf,
        sqft,
        beds,
        baths,
        propertyType,
        yearBuilt: merged.yearBuilt,
        lotSqft: merged.lotSqft,
        condition,
        renovation,
        marketTrend: marketBlock.trend,
      },
      rangeBandPct
    );

    const intent = body.intent === "buyer" || body.intent === "investor" ? body.intent : "seller";
    const recommendations = getToolkitRecommendations(intent);

    await upsertHomeValueSession({
      sessionId,
      userId,
      addressRaw,
      merged,
      condition,
      renovation,
      estimate,
      confidence,
      likelyIntent: intent,
    });

    await insertToolEvent({
      sessionId,
      userId,
      toolName: "home_value",
      eventName: "estimate_run",
      metadata: {
        priced_comp_count: pricedCompCount,
        total_comp: totalComp,
        market_source: marketBlock.source,
        address_quality: addressQuality,
      },
    });

    if (merged.city && (marketBlock.pricePerSqft != null || estimate.baselinePpsf > 0)) {
      const ppsf =
        marketBlock.pricePerSqft != null && marketBlock.pricePerSqft > 0
          ? Number(marketBlock.pricePerSqft)
          : estimate.baselinePpsf;
      await maybeInsertMarketSnapshot({
        city: merged.city,
        zip: merged.zip,
        propertyType: propertyType,
        medianPpsf: ppsf,
        medianPrice: marketBlock.medianPrice,
        yoyTrendPct: trendToYoYPct(marketBlock.trend),
        avgDaysOnMarket: daysOnMarket,
        compCount: pricedCompCount,
      });
    }

    return NextResponse.json({
      ok: true,
      sessionId,
      normalizedProperty: merged,
      estimate,
      confidence,
      market: marketBlock,
      comps: {
        pricedCount: pricedCompCount,
        totalConsidered: totalComp,
      },
      recommendations,
    });
  } catch (e: any) {
    console.error("home-value-estimate", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
