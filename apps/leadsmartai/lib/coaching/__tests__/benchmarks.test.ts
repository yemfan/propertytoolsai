import { describe, expect, it } from "vitest";

import {
  computePeerBenchmarks,
  describeRankAgainstPeers,
  MIN_PEER_POPULATION,
  rankAgentAgainstPeers,
} from "@/lib/coaching/benchmarks";

describe("computePeerBenchmarks", () => {
  it("returns null for empty input", () => {
    expect(computePeerBenchmarks([])).toBeNull();
  });

  it("filters out non-finite + non-positive values", () => {
    const out = computePeerBenchmarks([
      Number.NaN,
      Number.POSITIVE_INFINITY,
      0,
      -5,
      8,
    ]);
    expect(out?.populationSize).toBe(1);
    expect(out?.medianMinutes).toBe(8);
  });

  it("computes percentiles via type-7 linear interpolation", () => {
    // Simple known case: [1, 2, 3, 4, 5]
    //   P25 = 2 (rank 1)
    //   P50 = 3 (rank 2)
    //   P75 = 4 (rank 3)
    const out = computePeerBenchmarks([1, 2, 3, 4, 5]);
    expect(out).toEqual({
      topQuartileMinutes: 2,
      medianMinutes: 3,
      bottomQuartileMinutes: 4,
      populationSize: 5,
    });
  });

  it("interpolates between values for non-integer ranks", () => {
    // [10, 20, 30, 40] — P25 sits between 10 and 20.
    //   rank = 0.25 * 3 = 0.75 → 10*(0.25) + 20*(0.75) = 17.5
    const out = computePeerBenchmarks([10, 20, 30, 40]);
    expect(out?.topQuartileMinutes).toBeCloseTo(17.5, 5);
    expect(out?.medianMinutes).toBeCloseTo(25, 5);
    expect(out?.bottomQuartileMinutes).toBeCloseTo(32.5, 5);
  });

  it("single-value population reports same value at every percentile", () => {
    const out = computePeerBenchmarks([7]);
    expect(out).toEqual({
      topQuartileMinutes: 7,
      medianMinutes: 7,
      bottomQuartileMinutes: 7,
      populationSize: 1,
    });
  });

  it("doesn't mutate input order", () => {
    const input = [5, 1, 3, 2, 4];
    computePeerBenchmarks(input);
    expect(input).toEqual([5, 1, 3, 2, 4]);
  });
});

describe("rankAgentAgainstPeers", () => {
  function bench(opts: {
    p25?: number;
    p50?: number;
    p75?: number;
    pop?: number;
  } = {}) {
    return {
      topQuartileMinutes: opts.p25 ?? 5,
      medianMinutes: opts.p50 ?? 10,
      bottomQuartileMinutes: opts.p75 ?? 15,
      populationSize: opts.pop ?? MIN_PEER_POPULATION,
    };
  }

  it("returns 'unknown' when agent average is null/non-finite", () => {
    expect(rankAgentAgainstPeers(null, bench())).toBe("unknown");
    expect(rankAgentAgainstPeers(Number.NaN, bench())).toBe("unknown");
  });

  it("returns 'unknown' when benchmarks are null", () => {
    expect(rankAgentAgainstPeers(5, null)).toBe("unknown");
  });

  it("returns 'unknown' when peer pool is below the minimum population", () => {
    expect(
      rankAgentAgainstPeers(5, bench({ pop: MIN_PEER_POPULATION - 1 })),
    ).toBe("unknown");
  });

  it("flags 'top_quartile' when agent <= P25 (faster than 75% of peers)", () => {
    expect(rankAgentAgainstPeers(5, bench({ p25: 5 }))).toBe("top_quartile");
    expect(rankAgentAgainstPeers(3, bench({ p25: 5 }))).toBe("top_quartile");
  });

  it("flags 'median' when between P25 and P75", () => {
    expect(
      rankAgentAgainstPeers(10, bench({ p25: 5, p75: 15 })),
    ).toBe("median");
    expect(
      rankAgentAgainstPeers(15, bench({ p25: 5, p75: 15 })),
    ).toBe("median");
  });

  it("flags 'bottom_quartile' when agent > P75", () => {
    expect(
      rankAgentAgainstPeers(20, bench({ p75: 15 })),
    ).toBe("bottom_quartile");
  });
});

describe("describeRankAgainstPeers", () => {
  function bench() {
    return {
      topQuartileMinutes: 4.2,
      medianMinutes: 8.5,
      bottomQuartileMinutes: 12,
      populationSize: 18,
    };
  }

  it("returns empty string for unknown rank", () => {
    expect(
      describeRankAgainstPeers({
        rank: "unknown",
        agentAverageMinutes: 10,
        benchmarks: bench(),
      }),
    ).toBe("");
  });

  it("returns empty string when benchmarks is null", () => {
    expect(
      describeRankAgainstPeers({
        rank: "top_quartile",
        agentAverageMinutes: 3,
        benchmarks: null,
      }),
    ).toBe("");
  });

  it("'top_quartile' description names P25 + population size", () => {
    const out = describeRankAgainstPeers({
      rank: "top_quartile",
      agentAverageMinutes: 3,
      benchmarks: bench(),
    });
    expect(out).toContain("Top quartile");
    expect(out).toContain("4.2m");
    expect(out).toContain("18 agents");
  });

  it("'median' description names current median + the top-quartile target", () => {
    const out = describeRankAgainstPeers({
      rank: "median",
      agentAverageMinutes: 9,
      benchmarks: bench(),
    });
    expect(out).toContain("median");
    expect(out).toContain("8.5m");
    expect(out).toContain("4.2m");
  });

  it("'bottom_quartile' description names P75", () => {
    const out = describeRankAgainstPeers({
      rank: "bottom_quartile",
      agentAverageMinutes: 14,
      benchmarks: bench(),
    });
    expect(out).toContain("75%");
    expect(out).toContain("12m");
  });

  it("renders sub-minute values as seconds", () => {
    const out = describeRankAgainstPeers({
      rank: "top_quartile",
      agentAverageMinutes: 0.3,
      benchmarks: {
        topQuartileMinutes: 0.5, // 30 seconds
        medianMinutes: 2,
        bottomQuartileMinutes: 5,
        populationSize: 10,
      },
    });
    expect(out).toContain("30s");
  });
});
