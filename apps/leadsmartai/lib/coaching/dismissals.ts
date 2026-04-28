import type { CoachingInsight } from "./insights";

/**
 * Pure dismissal-filter helpers for the coaching dashboard.
 *
 * The service queries `coaching_dismissals` rows (one per (agent,
 * insight_id) with a TTL `dismissed_until`), passes them through
 * `filterDismissedInsights` which drops any insight whose id has an
 * active dismissal. Lives in its own file (no `server-only`) so
 * vitest hits the math directly.
 *
 * Default snooze duration is 7 days. The dismiss endpoint accepts
 * an override so a future "snooze for 30 days" UX can layer in
 * without touching the schema.
 */

export type CoachingDismissal = {
  insightId: string;
  /** ISO timestamp; insight stays hidden until now() >= this. */
  dismissedUntil: string;
};

export const DEFAULT_DISMISS_DURATION_DAYS = 7;

/**
 * Compute the `dismissed_until` timestamp from a duration in days.
 * Pure — caller persists the returned ISO string.
 */
export function computeDismissedUntil(args: {
  nowIso: string;
  days?: number;
}): string {
  const days = clampDays(args.days);
  const ms = Date.parse(args.nowIso);
  if (!Number.isFinite(ms)) {
    // Defensive: caller should always pass a valid ISO. If it doesn't,
    // fall back to "right now" — the dismissal will already be expired
    // by the time it's persisted, which is a no-op rather than a
    // permanent block.
    return args.nowIso;
  }
  return new Date(ms + days * 86_400_000).toISOString();
}

/**
 * Drop insights whose id has an UNEXPIRED dismissal. Expired rows are
 * ignored — their cleanup is a separate concern (the service can run
 * a maintenance query nightly, or we leave them and let the row count
 * grow harmlessly).
 */
export function filterDismissedInsights(
  insights: ReadonlyArray<CoachingInsight>,
  dismissals: ReadonlyArray<CoachingDismissal>,
  nowIso: string,
): CoachingInsight[] {
  if (dismissals.length === 0) return [...insights];
  const activeIds = new Set<string>();
  for (const d of dismissals) {
    if (d.dismissedUntil > nowIso) activeIds.add(d.insightId);
  }
  if (activeIds.size === 0) return [...insights];
  return insights.filter((i) => !activeIds.has(i.id));
}

/**
 * Clamp the dismiss duration to a sensible window. Min 1 day so the
 * agent doesn't accidentally pick "0" and re-render the same card,
 * max 30 days so a stale dismissal can't outlive the data window the
 * coaching surface is built around.
 */
function clampDays(input: number | undefined): number {
  if (input == null || !Number.isFinite(input)) return DEFAULT_DISMISS_DURATION_DAYS;
  return Math.min(Math.max(Math.round(input), 1), 30);
}
