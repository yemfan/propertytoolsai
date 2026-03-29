export type { ApiFetchOptions, ApiFailure, ApiResult, ApiSuccess } from "./types";
export { apiFetch, apiFetchJson } from "./api-fetch";
export type { ApiEnvelope, ApiErr, ApiOk } from "./dto";
export { isApiErr, isApiOk } from "./dto";

/** Re-export shared DTOs for convenient client imports. */
export type {
  ConfidenceOutput,
  ConversationThread,
  ConversationTurn,
  HomeValueEstimateRequest,
  HomeValueEstimateResponse,
  Lead,
  LeadActivityEvent,
  LeadConversation,
  LeadCrm,
  LeadRowSnake,
  NotificationPayload,
  PushDeviceRegistration,
  ValuationEngineResult,
  ValuationResult,
} from "@leadsmart/shared";
