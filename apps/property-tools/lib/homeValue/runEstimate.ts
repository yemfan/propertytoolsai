/**
 * Home Value Estimate — end-to-end orchestration (address → enrichment → estimate → persist).
 * Used by POST /api/home-value-estimate (and alias /api/home-value/estimate → same).
 */
import { randomUUID } from "crypto";
import { getPropertyData } from "@/lib/getPropertyData";
import { getPropertyByAddress, getComparables, type PropertyRow } from "@/lib/propertyService";
import { getCityData } from "@/lib/cityDataEngine";
import { computeConfidence } from "@/lib/homeValue/confidenceEngine";
import {
  computeHomeValueEstimate,
  DEFAULT_BATHS,
  DEFAULT_BEDS,
  DEFAULT_SQFT,
} from "@/lib/homeValue/estimateEngine";
import { mergeNormalizedProperty } from "@/lib/homeValue/normalizeProperty";
import { buildHomeValueRecommendations } from "@/lib/homeValue/recommendations";
import type {
  HomeValueEstimateRequest,
  HomeValueEstimateResponse,
  PropertyCondition,
  RenovationLevel,
} from "@/lib/homeValue/types";
import {
  insertToolEvent,
  maybeInsertMarketSnapshot,
  upsertHomeValueSession,
} from "@/lib/homeValue/funnelPersistence";
import { resolveLikelyIntent } from "@/lib/homeValue/intentInference";

export type RunEstimateContext = {
  userId: string | null;
  /** When false, skip DB writes (for dry-run tests). */
  persist?: boolean;
};

function trendToYoYPct(trend: "up" | "down" | "stable"): number | null {
  if (trend === "up") return 3;
  if (trend === "down") return -3;
  if (trend === "stable") return 0;
  return null;
}

export async function runHomeValueEstimatePipeline(
  body: HomeValueEstimateRequest,
  ctx: RunEstimateContext
): Promise<HomeValueEstimateResponse> {
  const addressRaw = String(body.address ?? "").trim();
  if (!addressRaw) {
    throw new Error("address is required");
  }

  const sessionId = String(body.session_id ?? "").trim() || randomUUID();
  const userId = ctx.userId;
  const persist = ctx.persist !== false;

  const refresh = Boolean(body.refresh);

  let row: PropertyRow | null = null;
  try {
    await getPropertyData(addressRaw, refresh);
    row = await getPropertyByAddress(addressRaw);
  } catch {
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
        if (sold == null || sqft == null || !isFinite(sold) || !isFinite(sqft) || sqft <= 0) return null;
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
  let marketDataAgeHours: number | null | undefined = undefined;

  if (merged.city && merged.state) {
    try {
      const city = await getCityData({
        city: merged.city,
        state: merged.state,
        maxAgeHours: 72,
      });
      daysOnMarket = city.days_on_market ?? null;
      if (city.last_fetched_at) {
        const ms = Date.now() - new Date(city.last_fetched_at).getTime();
        if (Number.isFinite(ms) && ms >= 0) {
          marketDataAgeHours = ms / (1000 * 60 * 60);
        }
      }
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
    } catch {
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
    daysOnMarket,
    marketDataAgeHours,
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

  const priceSpreadRatio =
    estimate.point > 0 ? (estimate.high - estimate.low) / estimate.point : null;

  const intentResolution = resolveLikelyIntent({
    explicit: body.intent,
    propertyType: merged.propertyType,
    signals: body.intent_signals,
    priceSpreadRatio,
  });

  const likelyIntent = intentResolution.intent;
  const intentInference = {
    likely: intentResolution.likely,
    scores: intentResolution.scores,
    rationale: intentResolution.rationale,
    applied: intentResolution.intent,
  };

  const recommendations = buildHomeValueRecommendations({
    intent: likelyIntent,
    estimate,
    confidence,
    comps: { pricedCount: pricedCompCount, totalConsidered: totalComp },
    market: marketBlock,
    signals: body.intent_signals,
    propertyType: merged.propertyType,
    normalizedProperty: merged,
  });

  if (persist) {
    await upsertHomeValueSession({
      sessionId,
      userId,
      addressRaw,
      merged,
      condition,
      renovation,
      estimate,
      confidence,
      likelyIntent,
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
        propertyType,
        medianPpsf: ppsf,
        medianPrice: marketBlock.medianPrice,
        yoyTrendPct: trendToYoYPct(marketBlock.trend),
        avgDaysOnMarket: daysOnMarket,
        compCount: pricedCompCount,
      });
    }
  }

  return {
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
    intentInference,
  };
}
