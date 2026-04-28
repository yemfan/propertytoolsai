/**
 * Pure response-time peer-benchmark helpers.
 *
 * Replaces the hardcoded "5-minute top quartile" target in the response-
 * time insight with REAL percentiles computed from the platform-wide
 * agent population. Lives in its own file (no `server-only`) so vitest
 * exercises the math without supabase.
 *
 * Two responsibilities:
 *   1. Compute P25/P50/P75 from a list of agent average response
 *      times (the service-side query feeds in the raw averages).
 *   2. Render the agent's standing — "you're top quartile / median /
 *      bottom quartile" plus the actual numeric target the next tier
 *      sits at.
 */

export type PeerBenchmarks = {
  /** Top-quartile cutoff (P25 — lower is better, since this is response
   *  time). Anyone faster than this is "top 25%". */
  topQuartileMinutes: number;
  /** Median response time across all agents. */
  medianMinutes: number;
  /** Bottom-quartile cutoff (P75). Anyone slower is "bottom 25%". */
  bottomQuartileMinutes: number;
  /** How many agents the percentiles were computed from. The caller
   *  surfaces this so the UI can hide rank copy when n is too small
   *  (e.g. solo pilot — comparing to peers is meaningless). */
  populationSize: number;
};

export type PeerRank = "top_quartile" | "median" | "bottom_quartile" | "unknown";

/**
 * Compute percentiles from raw averages. Pure — caller passes the
 * full sorted-or-unsorted list. Returns `null` when the population
 * is empty, since percentiles are undefined; the caller falls back to
 * the hardcoded target in that case.
 *
 *   * Single-agent population — every percentile equals the same value;
 *     the rank-helper handles that edge by returning 'unknown'.
 *   * Tiny population (< MIN_POPULATION) — same; rank helper returns
 *     'unknown' so the UI doesn't claim "you're top quartile of 3."
 */
export const MIN_PEER_POPULATION = 5;

export function computePeerBenchmarks(
  averagesMinutes: ReadonlyArray<number>,
): PeerBenchmarks | null {
  const valid = averagesMinutes.filter(
    (n): n is number => typeof n === "number" && Number.isFinite(n) && n > 0,
  );
  if (valid.length === 0) return null;

  const sorted = [...valid].sort((a, b) => a - b);
  return {
    topQuartileMinutes: percentile(sorted, 0.25),
    medianMinutes: percentile(sorted, 0.5),
    bottomQuartileMinutes: percentile(sorted, 0.75),
    populationSize: sorted.length,
  };
}

/**
 * Map an agent's average to a peer rank. Returns 'unknown' when the
 * peer pool is too small for the comparison to be meaningful — the
 * UI then shows the raw target without rank copy.
 *
 * Response time is "lower is better" so the comparison flips:
 *   agent <= P25 → top quartile (faster than 75% of agents)
 *   agent <= P75 → middle two quartiles
 *   agent >  P75 → bottom quartile (slower than 75% of agents)
 */
export function rankAgentAgainstPeers(
  agentAverageMinutes: number | null,
  benchmarks: PeerBenchmarks | null,
): PeerRank {
  if (agentAverageMinutes == null || !Number.isFinite(agentAverageMinutes)) {
    return "unknown";
  }
  if (!benchmarks) return "unknown";
  if (benchmarks.populationSize < MIN_PEER_POPULATION) return "unknown";

  if (agentAverageMinutes <= benchmarks.topQuartileMinutes) return "top_quartile";
  if (agentAverageMinutes <= benchmarks.bottomQuartileMinutes) return "median";
  return "bottom_quartile";
}

/**
 * Build a one-liner the response-time insight uses in its description.
 * Examples:
 *   "Top quartile platform-wide (faster than 4.2m P25 across 18 agents)."
 *   "Around the median (8.5m). Top quartile is 4.2m."
 *   "Slower than 75% of agents (P75 is 12m)."
 *   ""    — when rank is 'unknown' (small pool)
 */
export function describeRankAgainstPeers(args: {
  rank: PeerRank;
  agentAverageMinutes: number | null;
  benchmarks: PeerBenchmarks | null;
}): string {
  if (args.rank === "unknown" || !args.benchmarks) return "";

  const top = formatMinutes(args.benchmarks.topQuartileMinutes);
  const median = formatMinutes(args.benchmarks.medianMinutes);
  const bottom = formatMinutes(args.benchmarks.bottomQuartileMinutes);
  const pop = args.benchmarks.populationSize;

  if (args.rank === "top_quartile") {
    return `Top quartile platform-wide (faster than the ${top} P25 across ${pop} agents).`;
  }
  if (args.rank === "median") {
    return `Around the median (${median}). Top quartile is ${top}.`;
  }
  return `Slower than 75% of agents on the platform — P75 is ${bottom}.`;
}

// ── internals ──────────────────────────────────────────────────────

/**
 * Linear-interpolation percentile (a.k.a. type-7 in R). Standard
 * choice for small samples.
 */
function percentile(sortedAsc: ReadonlyArray<number>, p: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const rank = p * (sortedAsc.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return sortedAsc[low];
  const frac = rank - low;
  return sortedAsc[low] * (1 - frac) + sortedAsc[high] * frac;
}

function formatMinutes(n: number): string {
  if (!Number.isFinite(n)) return "—";
  // < 1m → show seconds (still readable). Whole minutes for >= 1m.
  if (n < 1) return `${Math.round(n * 60)}s`;
  if (n < 10) return `${n.toFixed(1)}m`;
  return `${Math.round(n)}m`;
}
