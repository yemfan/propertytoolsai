import type { CalibrationScenarioKey } from "./types";

export function classifyValuationScenario(row: {
  comparable_count?: number;
  api_estimate?: number | null;
  tier_used?: string | null;
}): CalibrationScenarioKey {
  const compCount = Number(row.comparable_count || 0);
  const hasApi = Number(row.api_estimate || 0) > 0;
  const tier = String(row.tier_used || "").toLowerCase();
  const taxHeavy = tier.includes("tax");

  if (compCount >= 5) return "strong_comps";
  if (compCount >= 3) return "medium_comps";
  if (taxHeavy) return "tax_fallback";
  if (compCount > 0) return "weak_comps";
  if (hasApi) return "api_only";
  return "weak_comps";
}

export function defaultCalibrationProfile(scenarioKey: CalibrationScenarioKey) {
  switch (scenarioKey) {
    case "strong_comps":
      return {
        compsWeight: 0.6,
        apiWeight: 0.3,
        trendWeight: 0.1,
        taxWeight: 0.0,
        conditionCapPct: 0.1,
        confidencePenaltyPct: 0,
      };
    case "medium_comps":
      return {
        compsWeight: 0.5,
        apiWeight: 0.25,
        trendWeight: 0.1,
        taxWeight: 0.15,
        conditionCapPct: 0.1,
        confidencePenaltyPct: 0.02,
      };
    case "weak_comps":
      return {
        compsWeight: 0.35,
        apiWeight: 0.3,
        trendWeight: 0.1,
        taxWeight: 0.25,
        conditionCapPct: 0.08,
        confidencePenaltyPct: 0.04,
      };
    case "tax_fallback":
      return {
        compsWeight: 0.25,
        apiWeight: 0.25,
        trendWeight: 0.15,
        taxWeight: 0.35,
        conditionCapPct: 0.06,
        confidencePenaltyPct: 0.06,
      };
    case "api_only":
      return {
        compsWeight: 0.0,
        apiWeight: 0.7,
        trendWeight: 0.1,
        taxWeight: 0.2,
        conditionCapPct: 0.05,
        confidencePenaltyPct: 0.08,
      };
    default:
      return {
        compsWeight: 0.5,
        apiWeight: 0.25,
        trendWeight: 0.1,
        taxWeight: 0.15,
        conditionCapPct: 0.1,
        confidencePenaltyPct: 0.02,
      };
  }
}
