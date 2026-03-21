export type {
  LoadProgrammaticSeoExtras,
  OptimizationAction,
  SeoContentOverrideRow,
  SeoMetaOverride,
  SeoPageKey,
  SeoPerformanceSnapshot,
} from "./types";
export { encodeProgrammaticPageKey, decodeProgrammaticPageKey, programmaticUrlPath } from "./pageKey";
export { classifyOptimizationAction, getDefaultSeoRules } from "./rules";
export type { SeoRulesConfig, ClassifyInput } from "./rules";
export { mergeProgrammaticPayload, parseOverridePayload } from "./mergePayload";
export { runAiOptimization } from "./aiOptimizer";
export type { AiOptimizationOutput } from "./aiOptimizer";
export {
  fetchSeoContentOverride,
  fetchSeoContentOverrideSafe,
  insertPerformanceSnapshot,
  insertOptimizationRun,
  upsertSeoContentOverride,
  upsertTitleAbVariant,
  listLatestPerformanceKeys,
  getLatestPerformanceForPage,
} from "./db";
export { runOptimizationForPageKey, runWeeklyBatch, pageKeyFromSlugs } from "./pipeline";
export type { PipelineResult } from "./pipeline";
export { buildOptimizationSystemPrompt, buildOptimizationUserPrompt } from "./prompts";
