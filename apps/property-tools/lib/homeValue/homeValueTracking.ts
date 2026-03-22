/**
 * Standard home value funnel analytics events + shared metadata shape.
 */
import { trackEvent } from "@/lib/tracking";
import { trackToolEvent } from "@/lib/homeValue/toolEventsClient";

export const HOME_VALUE_ANALYTICS_EVENTS = {
  HOME_VALUE_STARTED: "home_value_started",
  ADDRESS_SELECTED: "address_selected",
  PROPERTY_DETAILS_LOADED: "property_details_loaded",
  ESTIMATE_GENERATED: "estimate_generated",
  ESTIMATE_REFINED: "estimate_refined",
  REPORT_GATE_SHOWN: "report_gate_shown",
  REPORT_UNLOCKED: "report_unlocked",
  LEAD_SUBMITTED: "lead_submitted",
  CMA_CLICKED: "cma_clicked",
  EXPERT_CTA_CLICKED: "expert_cta_clicked",
  RECOMMENDATION_CLICKED: "recommendation_clicked",
} as const;

export type HomeValueAnalyticsEvent =
  (typeof HOME_VALUE_ANALYTICS_EVENTS)[keyof typeof HOME_VALUE_ANALYTICS_EVENTS];

export type HomeValueTrackingMetadata = {
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  confidence?: string | null;
  likelyIntent?: string | null;
  sessionId?: string | null;
  source?: string;
  estimateUiState?: string;
  pricedCompCount?: number;
  [key: string]: unknown;
};

function cleanMeta(m: HomeValueTrackingMetadata): Record<string, unknown> {
  const out: Record<string, unknown> = { tool: "home_value" };
  for (const [k, v] of Object.entries(m)) {
    if (v !== undefined && v !== null && v !== "") out[k] = v;
  }
  return out;
}

/** Product analytics (POST /api/analytics/track). */
export function trackHomeValueAnalytics(
  event: HomeValueAnalyticsEvent,
  metadata: HomeValueTrackingMetadata = {}
): void {
  void trackEvent(event, cleanMeta(metadata));
}

/** Funnel row events (tool_events) when session id exists. */
export function trackHomeValueToolEvent(
  sessionId: string | undefined,
  event: HomeValueAnalyticsEvent,
  metadata: HomeValueTrackingMetadata = {}
): void {
  if (!sessionId?.trim()) {
    void trackHomeValueAnalytics(event, metadata);
    return;
  }
  void trackToolEvent(sessionId.trim(), "home_value", event, cleanMeta(metadata));
}
