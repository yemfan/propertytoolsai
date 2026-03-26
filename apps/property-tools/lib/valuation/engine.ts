import type { SubjectPropertyInput, ValuationDataBundle, ValuationFactor, ValuationResult } from "./types";
import { median, pctDiff, roundMoney } from "./math";
import { buildCompsEstimate, type CompsEstimateModel } from "./comps";
import { getConditionAdjustmentPct, getListingTrendAdjustmentPct } from "./adjustments";
import { calculateConfidenceScore, getRangeSpreadPct } from "./confidence";
import { getCalibrationForScenario } from "@/lib/valuation-calibration/apply";
import type { CalibrationApplication } from "@/lib/valuation-calibration/types";

const TREND_REFERENCE_WEIGHT = 0.1;

/** Legacy blend when calibration is not loaded (tests / offline use). */
const LEGACY_CALIBRATION: CalibrationApplication = {
  scenarioKey: "medium_comps",
  compsWeight: 0.6,
  apiWeight: 0.4,
  trendWeight: TREND_REFERENCE_WEIGHT,
  taxWeight: 0,
  conditionCapPct: 0.1,
  confidencePenaltyPct: 0,
};

function clampAbs(pct: number, cap: number) {
  return Math.max(-cap, Math.min(cap, pct));
}

function applyCalibrationToConfidence(score: number, calibration: CalibrationApplication) {
  const next = Math.round(score - calibration.confidencePenaltyPct * 100);
  return Math.max(10, Math.min(95, next));
}

/**
 * Loads scenario-based weights from `valuation_calibration_profiles` (or defaults) and runs the engine.
 */
export async function runValuationEngineAsync(
  subject: SubjectPropertyInput,
  bundle: ValuationDataBundle
): Promise<ValuationResult> {
  const compsModel = buildCompsEstimate(subject, bundle.comps);
  const calibration = await getCalibrationForScenario({
    comparableCount: compsModel.comparableCount,
    hasApiEstimate: Boolean(bundle.apiEstimate),
    tierUsed: null,
  });
  return runValuationEngineWithComps(subject, bundle, compsModel, calibration);
}

/**
 * Synchronous engine using the legacy 0.6/0.4 comps/API blend when both exist (no DB).
 */
export function runValuationEngine(subject: SubjectPropertyInput, bundle: ValuationDataBundle): ValuationResult {
  const compsModel = buildCompsEstimate(subject, bundle.comps);
  return runValuationEngineWithComps(subject, bundle, compsModel, LEGACY_CALIBRATION);
}

export function runValuationEngineWithComps(
  subject: SubjectPropertyInput,
  bundle: ValuationDataBundle,
  compsModel: CompsEstimateModel,
  calibration: CalibrationApplication
): ValuationResult {
  const warnings: string[] = [];
  const factors: ValuationFactor[] = [];

  const compsEstimate = compsModel.estimate;
  const taxAnchorEstimate =
    bundle.taxAnchorEstimate != null && Number.isFinite(bundle.taxAnchorEstimate)
      ? roundMoney(bundle.taxAnchorEstimate)
      : null;

  const activePpsfVals = bundle.activeListings
    .map((x) => x.pricePerSqft || (x.sqft ? x.listPrice / x.sqft : 0))
    .filter((x) => x > 0);
  const activeMedianPpsf = activePpsfVals.length > 0 ? median(activePpsfVals) : null;

  const listingTrendAdjustmentPct = getListingTrendAdjustmentPct({
    activeMedianPpsf,
    soldMedianPpsf: compsModel.soldMedianPpsf || null,
  });

  const rawConditionAdjustmentPct = getConditionAdjustmentPct(subject.condition, subject.remodeledYear);
  const conditionAdjustmentPct = clampAbs(rawConditionAdjustmentPct, calibration.conditionCapPct);

  let baseEstimate = 0;
  if (bundle.apiEstimate && compsEstimate) {
    const wa = calibration.apiWeight;
    const wc = calibration.compsWeight;
    const denom = wa + wc;
    baseEstimate = denom > 0 ? (bundle.apiEstimate * wa + compsEstimate * wc) / denom : bundle.apiEstimate * 0.4 + compsEstimate * 0.6;
  } else if (compsEstimate) {
    baseEstimate = compsEstimate;
    warnings.push("API estimate unavailable; valuation relies mainly on comparable sales.");
  } else if (bundle.apiEstimate) {
    baseEstimate = bundle.apiEstimate;
    warnings.push("Comparable sales are limited; valuation relies mainly on automated estimate.");
  } else {
    warnings.push("Not enough data for a stable estimate.");
    baseEstimate = 0;
  }

  if (!baseEstimate) {
    return {
      finalEstimate: 0,
      lowEstimate: 0,
      highEstimate: 0,
      confidenceScore: 10,
      confidenceLabel: "low",
      comparableCount: compsModel.comparableCount,
      weightedPpsf: compsModel.weightedPpsf,
      apiEstimate: bundle.apiEstimate ?? null,
      compsEstimate: compsEstimate ?? null,
      taxAnchorEstimate: null,
      listingTrendAdjustmentPct,
      conditionAdjustmentPct,
      rangeSpreadPct: 0.18,
      calibrationScenarioKey: calibration.scenarioKey,
      factors: [
        {
          label: "Limited valuation data",
          impact: "negative",
          note: "There are not enough reliable comps or API signals. Recommend custom review.",
        },
      ],
      compsUsed: compsModel.selected,
      warnings,
    };
  }

  const apiVsCompsDiffPct =
    bundle.apiEstimate && compsEstimate ? pctDiff(bundle.apiEstimate, compsEstimate) : null;
  if ((apiVsCompsDiffPct || 0) >= 0.2) {
    warnings.push("API estimate and comparable-sales estimate differ significantly. Confidence reduced.");
  }

  const trendScale =
    TREND_REFERENCE_WEIGHT > 0 ? calibration.trendWeight / TREND_REFERENCE_WEIGHT : 1;
  const effectiveTrendPct = listingTrendAdjustmentPct * trendScale;
  const afterTrend = baseEstimate * (1 + effectiveTrendPct);
  const finalEstimate = afterTrend * (1 + conditionAdjustmentPct);

  const { score: baseConfidenceScore } = calculateConfidenceScore({
    comparableCount: compsModel.comparableCount,
    hasApiEstimate: Boolean(bundle.apiEstimate),
    avgCompDistanceMiles: compsModel.avgDistanceMiles,
    apiVsCompsDiffPct,
    hasSqft: Boolean(subject.sqft),
  });

  const adjustedScore = applyCalibrationToConfidence(baseConfidenceScore, calibration);
  let rangeSpreadPct =
    getRangeSpreadPct(adjustedScore, compsModel.comparableCount) + calibration.taxWeight * 0.06;
  rangeSpreadPct = Math.min(0.45, rangeSpreadPct);

  const confidenceLabel =
    adjustedScore >= 75 ? "high" : adjustedScore >= 50 ? "medium" : "low";

  const lowEstimate = finalEstimate * (1 - rangeSpreadPct);
  const highEstimate = finalEstimate * (1 + rangeSpreadPct);

  if (compsModel.comparableCount < 3) {
    warnings.push(
      "Fewer than 3 strong comparable sales were found. Show a wider range and encourage custom valuation."
    );
  }

  factors.push({
    label: "Comparable sales",
    impact: compsModel.comparableCount >= 5 ? "positive" : "neutral",
    value: compsModel.comparableCount,
    note: `${compsModel.comparableCount} comparable sales were used in the pricing model.`,
  });

  if (bundle.apiEstimate) {
    factors.push({
      label: "Automated estimate",
      impact: "neutral",
      value: roundMoney(bundle.apiEstimate),
      note: "Public-data AVM used as one signal, not the only source of truth.",
    });
  }

  if (listingTrendAdjustmentPct !== 0) {
    factors.push({
      label: "Active market trend",
      impact: listingTrendAdjustmentPct > 0 ? "positive" : "negative",
      value: `${Math.round(listingTrendAdjustmentPct * 1000) / 10}%`,
      note: "Nearby active listings suggest a modest adjustment relative to sold comps.",
    });
  }

  if (conditionAdjustmentPct !== 0) {
    factors.push({
      label: "Condition adjustment",
      impact: conditionAdjustmentPct > 0 ? "positive" : "negative",
      value: `${Math.round(conditionAdjustmentPct * 1000) / 10}%`,
      note: "Condition and remodeling inputs adjust the estimate for real-world variance.",
    });
  }

  return {
    finalEstimate: roundMoney(finalEstimate),
    lowEstimate: roundMoney(lowEstimate),
    highEstimate: roundMoney(highEstimate),
    confidenceScore: adjustedScore,
    confidenceLabel,
    comparableCount: compsModel.comparableCount,
    weightedPpsf: compsModel.weightedPpsf ? roundMoney(compsModel.weightedPpsf) : null,
    apiEstimate: bundle.apiEstimate ? roundMoney(bundle.apiEstimate) : null,
    compsEstimate: compsEstimate ? roundMoney(compsEstimate) : null,
    taxAnchorEstimate,
    listingTrendAdjustmentPct,
    conditionAdjustmentPct,
    rangeSpreadPct,
    calibrationScenarioKey: calibration.scenarioKey,
    factors,
    compsUsed: compsModel.selected,
    warnings,
  };
}
