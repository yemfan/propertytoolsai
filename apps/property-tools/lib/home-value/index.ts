/**
 * Recommended public entry for home value domain logic (maps to `lib/homeValue/*`).
 * Prefer `@/lib/homeValue/...` imports in app code; this barrel matches docs layout.
 */
export {
  deriveEstimateUiState,
  describeEstimateUiState,
  isReportGateVisible,
  type EstimateUiStateInput,
} from "@/lib/homeValue/estimateUiState";
/** Funnel / HomeValueTool state machine (distinct from `EstimateUiState` in `./types` — /home-value page flow). */
export type { EstimateUiState as HomeValueFunnelUiState } from "@/lib/homeValue/estimateUiState";
export * from "@/lib/homeValue/homeValueTracking";
export * from "@/lib/homeValue/estimateDisplay";
export * from "@/lib/homeValue/normalizeEstimateRequestBody";
export * from "./agent-notification";
export * from "./assignment";
export * from "./conversation";
export * from "./email";
export * from "./estimate-engine";
export * from "./followup";
export * from "./followup-sequence";
export * from "./handle-reply";
export * from "./history";
export * from "./lead";
export * from "./pause-sequence";
export * from "./reply-handler";
export * from "./report-pdf";
export * from "./report-template";
export * from "./types";
export {
  useHomeValueEstimate,
  readOrCreateHomeValueSessionId,
  dbPropertyTypeToHomeValueUi,
} from "./useHomeValueEstimate";
