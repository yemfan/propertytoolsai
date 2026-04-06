export { computeWeeklyMetrics } from "./metricsCalculator";
export { generateInsights } from "./insightRules";
export { buildDigestForAgent, buildAllDigests, getLatestDigest } from "./digestBuilder";
export type {
  WeeklyMetrics,
  DigestInsight,
  DigestPayload,
  PerformanceDigestRow,
} from "./types";
