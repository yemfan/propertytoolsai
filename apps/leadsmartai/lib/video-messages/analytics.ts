/**
 * Pure helpers for video-message analytics.
 *
 * Three small functions:
 *   - computeWatchPct(durationSec, watchedSec) — clamps the
 *     ratio to 0..100 and rounds. Handles divide-by-zero
 *   - isCountableView(watchPct, watchedSec) — predicate gating
 *     "this counts as a real view." Avoids logging every page
 *     load that didn't actually play. Default threshold:
 *     watched_seconds ≥ 3 OR watch_pct ≥ 25
 *   - formatDuration(seconds) — "0:42", "2:05" for player UI
 *
 * Lives without `server-only` so vitest hits it directly.
 */

export function computeWatchPct(
  durationSec: number,
  watchedSec: number,
): number {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return 0;
  if (!Number.isFinite(watchedSec) || watchedSec <= 0) return 0;
  const ratio = watchedSec / durationSec;
  const clamped = Math.max(0, Math.min(1, ratio));
  return Math.round(clamped * 100);
}

export type ViewQualityInput = {
  watchPct: number;
  watchedSeconds: number;
  /** Override default thresholds — useful for short videos
   *  where 3 seconds isn't a meaningful threshold. */
  minSeconds?: number;
  minPct?: number;
};

/**
 * Should this view count toward `view_count`? The default
 * thresholds are deliberately permissive — anything more than a
 * page-load-and-bounce qualifies. `unique_view_count` (separate
 * counter) handles dedup-by-ip elsewhere.
 */
export function isCountableView(input: ViewQualityInput): boolean {
  const minSec = input.minSeconds ?? 3;
  const minPct = input.minPct ?? 25;
  return input.watchedSeconds >= minSec || input.watchPct >= minPct;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
