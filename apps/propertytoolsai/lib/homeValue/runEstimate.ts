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
import { loadValuationBundleFromRentcast } from "@/lib/valuation/adapters/rentcast";

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

  /**
   * Rentcast AVM — call early so we have a professional-grade
   * estimate to use as the primary value or as a fallback when
   * local comps are insufficient. The Rentcast AVM is derived
   * from their nationwide MLS dataset and tends to be within
   * 5-10% of Zillow/Redfin estimates.
   *
   * We also pull the property details (sqft, beds, baths, year
   * built, property type) from the AVM response's subjectProperty
   * so the estimate uses real data instead of defaults.
   */
  let rentcastAvm: number | null = null;
  let rentcastAvmLow: number | null = null;
  let rentcastAvmHigh: number | null = null;
  let rentcastBundle: Awaited<ReturnType<typeof loadValuationBundleFromRentcast>> | null = null;
  try {
    if (process.env.RENTCAST_API_KEY?.trim()) {
      const bundle = await loadValuationBundleFromRentcast({
        address: addressRaw,
        city: body.city ?? row?.city ?? undefined,
        state: body.state ?? row?.state ?? undefined,
        zip: body.zip ?? row?.zip_code ?? undefined,
      });
      rentcastBundle = bundle;
      rentcastAvm = bundle.apiEstimate;
      // Extract range + subject property from the raw response
      // The bundle doesn't expose these directly, so we'll
      // compute a ±15% range if the AVM is available.
      if (rentcastAvm && rentcastAvm > 0) {
        rentcastAvmLow = Math.round(rentcastAvm * 0.85);
        rentcastAvmHigh = Math.round(rentcastAvm * 1.15);
        console.log(`[estimate] Rentcast AVM: $${rentcastAvm.toLocaleString()}`);
      }
    }
  } catch (e) {
    console.error("[estimate] Rentcast AVM fetch failed:", e);
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

  /**
   * Enrich merged property with Rentcast subject details when
   * the warehouse/body doesn't have real values. This fixes the
   * persistent "1500 sqft / 3 bed / 2 bath" default problem —
   * the Rentcast /v1/properties endpoint returns the actual
   * property attributes (e.g., 1633 sqft, 3 bed, 3 bath, 2003)
   * but they weren't being used.
   */
  /**
   * Rentcast property enrichment. Use Rentcast data when the
   * user's request body didn't explicitly provide a value.
   * This fixes stale warehouse defaults (1500 sqft, 2 bath,
   * Single Family) while still respecting user refinement
   * choices from the form.
   *
   * Priority: user form input > Rentcast > warehouse > defaults
   */
  const rd = rentcastBundle?.subjectDetails;
  if (rd) {
    // body.sqft/beds/baths are set when the user typed them in
    // the refinement form. When null/undefined, the user didn't
    // provide a value and we should use Rentcast.
    if (body.sqft == null && rd.sqft && rd.sqft > 0) merged.sqft = rd.sqft;
    if (body.beds == null && rd.beds && rd.beds > 0) merged.beds = rd.beds;
    if (body.baths == null && rd.baths && rd.baths > 0) merged.baths = rd.baths;
    if (body.yearBuilt == null && rd.yearBuilt && rd.yearBuilt > 1800) merged.yearBuilt = rd.yearBuilt;
    if (body.lotSqft == null && rd.lotSize && rd.lotSize > 0) merged.lotSqft = rd.lotSize;
    if (body.propertyType == null && rd.propertyType) merged.propertyType = rd.propertyType;
  }

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

  let estimate = computeHomeValueEstimate(
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
      sqftAdded: body.sqftAdded,
    },
    rangeBandPct
  );

  /**
   * Rentcast AVM blending — the Rentcast AVM uses nationwide MLS
   * data and tends to be within 5-10% of Zillow/Redfin. Our comp-
   * based PPSF × sqft approach can diverge significantly when the
   * subject property is much larger/smaller than nearby comps.
   *
   * Strategy:
   * - 0 local comps → use Rentcast AVM directly
   * - 1-3 comps → blend 70% AVM + 30% comp-based
   * - 4+ comps → blend 50% AVM + 50% comp-based
   *
   * This prevents wild over/under-estimates while still respecting
   * user refinement inputs (condition, renovation) from the comp-
   * based calculation.
   */
  if (rentcastAvm && rentcastAvm > 0) {
    const avmWeight =
      pricedCompCount === 0 ? 1.0 : pricedCompCount <= 3 ? 0.7 : 0.5;
    const compWeight = 1 - avmWeight;

    const blended = Math.round(avmWeight * rentcastAvm + compWeight * estimate.point);
    const blendedPpsf = sqft > 0 ? Math.round(blended / sqft) : estimate.baselinePpsf;

    // Apply the same range band percentage from confidence engine
    const blendedLow = Math.round(blended * (1 - rangeBandPct));
    const blendedHigh = Math.round(blended * (1 + rangeBandPct));

    console.log(
      `[estimate] Blending: AVM=$${rentcastAvm.toLocaleString()} (${Math.round(avmWeight * 100)}%) ` +
      `+ comp-based=$${estimate.point.toLocaleString()} (${Math.round(compWeight * 100)}%) ` +
      `→ $${blended.toLocaleString()} (${pricedCompCount} comps)`
    );

    estimate = {
      ...estimate,
      point: blended,
      low: blendedLow,
      high: blendedHigh,
      baselinePpsf: blendedPpsf,
      summary:
        pricedCompCount === 0
          ? `Estimated value near $${blended.toLocaleString()} ` +
            `(range about $${blendedLow.toLocaleString()}–$${blendedHigh.toLocaleString()}) ` +
            `based on automated valuation model and your property details.`
          : `Estimated value near $${blended.toLocaleString()} ` +
            `(range about $${blendedLow.toLocaleString()}–$${blendedHigh.toLocaleString()}) ` +
            `blending ${pricedCompCount} comparable sale${pricedCompCount > 1 ? "s" : ""} ` +
            `with automated valuation model.`,
    };
    marketBlock.source =
      pricedCompCount === 0
        ? "rentcast_avm"
        : `${marketBlock.source}+rentcast_avm_blend`;
  }

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
