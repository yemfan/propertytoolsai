export type CalibrationScenarioKey =
  | "strong_comps"
  | "medium_comps"
  | "weak_comps"
  | "tax_fallback"
  | "api_only";

export type CalibrationProfile = {
  scenarioKey: CalibrationScenarioKey;
  compsWeight: number;
  apiWeight: number;
  trendWeight: number;
  taxWeight: number;
  conditionCapPct: number;
  confidencePenaltyPct: number;
  sampleSize: number;
  medianErrorPct: number;
  insideRangePct: number;
  version: number;
  notes?: string | null;
};

/** Weights + caps applied by the valuation engine for a single run. */
export type CalibrationApplication = {
  scenarioKey: CalibrationScenarioKey;
  compsWeight: number;
  apiWeight: number;
  trendWeight: number;
  taxWeight: number;
  conditionCapPct: number;
  confidencePenaltyPct: number;
};

export type CalibrationCandidate = {
  scenarioKey: CalibrationScenarioKey;
  sampleSize: number;
  medianErrorPct: number;
  insideRangePct: number;
  suggested: {
    compsWeight: number;
    apiWeight: number;
    trendWeight: number;
    taxWeight: number;
    conditionCapPct: number;
    confidencePenaltyPct: number;
  };
  notes: string[];
};
