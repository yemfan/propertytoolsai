/**
 * Fire-and-forget product analytics to `/api/analytics/track`.
 *
 * CMA / comparison examples: `cma_completed`, `compare_clicked`,
 * `cma_compare_ai_picks_preview_shown`, `cma_compare_ai_picks_continue`.
 * Expert funnel: `expert_cta_clicked`, `lead_created`, `agent_matched` (see `ExpertCTA` / `LeadCaptureModal`).
 * Personalization: `mortgage_used`, `cma_used`, `property_viewed`, `comparison_started`, `agent_clicked`,
 * `recommendation_shown`, `recommendation_clicked` (see `lib/tracking.ts`, `NextSteps`).
 * Conversion outreach: `outreach_sent`, `outreach_metric` (see `lib/outreach.ts`, `docs/CONVERSION_OUTREACH.md`).
 */

export async function trackEvent(
  eventType: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await fetch("/api/analytics/track", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType,
        metadata: metadata ?? {},
      }),
    });
  } catch {
    /* ignore */
  }
}
