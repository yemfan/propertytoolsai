import { DEFAULT_FUNNEL_STEPS } from "./types";
import type { FunnelStep } from "./types";

/**
 * Count events per funnel step (total events, not unique users).
 * For session-unique counts, use funnel steps with session dedupe upstream.
 */
export function buildFunnelFromCounts(
  countsByStep: Record<string, number>,
  steps: readonly string[] = DEFAULT_FUNNEL_STEPS
): FunnelStep[] {
  const first = steps.map((s) => countsByStep[s] ?? 0);
  const top = first[0] || 1;

  return steps.map((step, i) => {
    const count = first[i];
    const prev = i === 0 ? count : first[i - 1];
    const pctOfFirst = top > 0 ? Number(((count / top) * 100).toFixed(1)) : 0;
    const dropOffPct =
      i > 0 && prev > 0 ? Number((((prev - count) / prev) * 100).toFixed(1)) : null;
    return { step, count, pctOfFirst, dropOffPct };
  });
}
