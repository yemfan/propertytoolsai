/**
 * Client-side product analytics. Persists to `public.events` via POST /api/analytics/track.
 * Behavioral helpers also append to localStorage for `buildUserProfile` / Next Steps.
 */
import { appendBehaviorEvent } from "@/lib/behaviorStore";

export async function trackEvent(
  eventType: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    const res = await fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType, metadata }),
      keepalive: true,
    });
    if (!res.ok && process.env.NODE_ENV === "development") {
      const j = await res.json().catch(() => ({}));
      console.warn("[trackEvent]", eventType, res.status, j);
    }
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[trackEvent] failed", eventType, e);
    }
  }
}

async function trackBehavior(eventType: string, metadata: Record<string, unknown> = {}): Promise<void> {
  appendBehaviorEvent({ type: eventType, metadata });
  await trackEvent(eventType, metadata);
}

/** User ran mortgage / financing workflows. */
export function trackMortgageUsed(metadata?: Record<string, unknown>) {
  return trackBehavior("mortgage_used", metadata ?? {});
}

/** CMA or pricing workflow. */
export function trackCmaUsed(metadata?: Record<string, unknown>) {
  return trackBehavior("cma_used", metadata ?? {});
}

/** Viewed a specific property address (listing, comp, or home value). */
export function trackPropertyViewed(metadata?: Record<string, unknown>) {
  return trackBehavior("property_viewed", metadata ?? {});
}

/** Started multi-property comparison. */
export function trackComparisonStarted(metadata?: Record<string, unknown>) {
  return trackBehavior("comparison_started", metadata ?? {});
}

/** Clicked agent / expert / contact CTAs. */
export function trackAgentClicked(metadata?: Record<string, unknown>) {
  return trackBehavior("agent_clicked", metadata ?? {});
}

/** Optional extra signals for profile (not in spec list but used by `buildUserProfile`). */
export function trackHomeValueUsed(metadata?: Record<string, unknown>) {
  return trackBehavior("home_value_used", metadata ?? {});
}

export function trackCapRateUsed(metadata?: Record<string, unknown>) {
  return trackBehavior("cap_rate_used", metadata ?? {});
}

export function trackAffordabilityUsed(metadata?: Record<string, unknown>) {
  return trackBehavior("affordability_used", metadata ?? {});
}

export function trackRentVsBuyUsed(metadata?: Record<string, unknown>) {
  return trackBehavior("rent_vs_buy_used", metadata ?? {});
}

export function trackDownPaymentUsed(metadata?: Record<string, unknown>) {
  return trackBehavior("down_payment_used", metadata ?? {});
}
export function trackCashFlowUsed(metadata?: Record<string, unknown>) {
  return trackBehavior("cash_flow_used", metadata ?? {});
}
export function trackCapRateRoiUsed(metadata?: Record<string, unknown>) {
  return trackBehavior("cap_rate_roi_used", metadata ?? {});
}
export function trackAdjustableRateUsed(metadata?: Record<string, unknown>) {
  return trackBehavior("adjustable_rate_used", metadata ?? {});
}
export function trackRefinanceUsed(metadata?: Record<string, unknown>) {
  return trackBehavior("refinance_used", metadata ?? {});
}
