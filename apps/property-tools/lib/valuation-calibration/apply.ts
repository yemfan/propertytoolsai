import { supabaseAdmin } from "@/lib/supabase/admin";
import { classifyValuationScenario, defaultCalibrationProfile } from "./scenarios";
import type { CalibrationApplication, CalibrationScenarioKey } from "./types";

export async function getCalibrationForScenario(input: {
  comparableCount: number;
  hasApiEstimate: boolean;
  tierUsed?: string | null;
}): Promise<CalibrationApplication> {
  const scenarioKey = classifyValuationScenario({
    comparable_count: input.comparableCount,
    api_estimate: input.hasApiEstimate ? 1 : 0,
    tier_used: input.tierUsed ?? null,
  });

  const { data, error } = await supabaseAdmin
    .from("valuation_calibration_profiles")
    .select("*")
    .eq("scenario_key", scenarioKey)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const d = defaultCalibrationProfile(scenarioKey);
    return {
      scenarioKey,
      compsWeight: d.compsWeight,
      apiWeight: d.apiWeight,
      trendWeight: d.trendWeight,
      taxWeight: d.taxWeight,
      conditionCapPct: d.conditionCapPct,
      confidencePenaltyPct: d.confidencePenaltyPct,
    };
  }

  return {
    scenarioKey: scenarioKey as CalibrationScenarioKey,
    compsWeight: Number(data.comps_weight),
    apiWeight: Number(data.api_weight),
    trendWeight: Number(data.trend_weight),
    taxWeight: Number(data.tax_weight),
    conditionCapPct: Number(data.condition_cap_pct),
    confidencePenaltyPct: Number(data.confidence_penalty_pct),
  };
}
