import { describe, expect, it } from "vitest";

import {
  buildDripHealthInsight,
  buildPastDueCommissionInsight,
  buildResponseTimeInsight,
  buildStaleContactsInsight,
  buildUnrepliedHotLeadsInsight,
  sortInsightsBySeverity,
  type CoachingInsight,
} from "@/lib/coaching/insights";

// ── Stale contacts ─────────────────────────────────────────────────

describe("buildStaleContactsInsight", () => {
  it("returns null when no stale contacts", () => {
    expect(
      buildStaleContactsInsight({
        staleCount: 0,
        oldestDays: 0,
        thresholdDays: 90,
        cohortSize: 10,
      }),
    ).toBeNull();
  });

  it("returns info severity when ratio < 20%", () => {
    const out = buildStaleContactsInsight({
      staleCount: 1,
      oldestDays: 100,
      thresholdDays: 90,
      cohortSize: 100,
    });
    expect(out?.severity).toBe("info");
  });

  it("returns warn severity at 20-50% ratio", () => {
    const out = buildStaleContactsInsight({
      staleCount: 30,
      oldestDays: 120,
      thresholdDays: 90,
      cohortSize: 100,
    });
    expect(out?.severity).toBe("warn");
  });

  it("returns crit severity at 50%+ ratio", () => {
    const out = buildStaleContactsInsight({
      staleCount: 60,
      oldestDays: 200,
      thresholdDays: 90,
      cohortSize: 100,
    });
    expect(out?.severity).toBe("crit");
  });

  it("singular copy for staleCount=1", () => {
    const out = buildStaleContactsInsight({
      staleCount: 1,
      oldestDays: 100,
      thresholdDays: 90,
      cohortSize: 100,
    });
    expect(out?.description).toMatch(/1 past client/);
  });

  it("plural copy for staleCount>1 with oldest-days callout", () => {
    const out = buildStaleContactsInsight({
      staleCount: 8,
      oldestDays: 153,
      thresholdDays: 90,
      cohortSize: 100,
    });
    expect(out?.description).toContain("8 past client");
    expect(out?.description).toContain("Oldest: 153 days");
  });

  it("guards against zero cohort size (avoids NaN ratio)", () => {
    const out = buildStaleContactsInsight({
      staleCount: 1,
      oldestDays: 100,
      thresholdDays: 90,
      cohortSize: 0,
    });
    expect(out?.severity).toBe("info");
  });
});

// ── Response time ──────────────────────────────────────────────────

describe("buildResponseTimeInsight", () => {
  it("returns null when no data (avgMinutes is null)", () => {
    expect(
      buildResponseTimeInsight({ avgMinutes: null, benchmarkMinutes: 5 }),
    ).toBeNull();
  });

  it("info + positive copy when faster than benchmark", () => {
    const out = buildResponseTimeInsight({ avgMinutes: 3, benchmarkMinutes: 5 });
    expect(out?.severity).toBe("info");
    expect(out?.title).toMatch(/on point/i);
  });

  it("info severity when within 1.5x benchmark (room to improve, not alarming)", () => {
    const out = buildResponseTimeInsight({ avgMinutes: 7, benchmarkMinutes: 5 });
    expect(out?.severity).toBe("info");
  });

  it("warn severity at 1.5–4x benchmark", () => {
    const out = buildResponseTimeInsight({ avgMinutes: 12, benchmarkMinutes: 5 });
    expect(out?.severity).toBe("warn");
  });

  it("crit severity at 4x+ benchmark", () => {
    const out = buildResponseTimeInsight({ avgMinutes: 25, benchmarkMinutes: 5 });
    expect(out?.severity).toBe("crit");
    expect(out?.description).toMatch(/gone elsewhere/i);
  });

  it("metric reflects the agent's actual avg", () => {
    const out = buildResponseTimeInsight({ avgMinutes: 12, benchmarkMinutes: 5 });
    expect(out?.metric?.value).toBe("12m");
  });
});

// ── Drip health ────────────────────────────────────────────────────

describe("buildDripHealthInsight", () => {
  it("returns null when no enrollments at all", () => {
    expect(
      buildDripHealthInsight({
        activeCount: 0,
        exitedCount: 0,
        completedCount: 0,
        enrolledLastWeek: 0,
      }),
    ).toBeNull();
  });

  it("warn severity when exit rate >= 40% AND >= 5 exits", () => {
    const out = buildDripHealthInsight({
      activeCount: 10,
      exitedCount: 8,
      completedCount: 2,
      enrolledLastWeek: 0,
    });
    expect(out?.severity).toBe("warn");
    expect(out?.title).toMatch(/exit rate/i);
  });

  it("ignores exit-rate alarm when absolute exits < 5 (small sample)", () => {
    const out = buildDripHealthInsight({
      activeCount: 1,
      exitedCount: 4,
      completedCount: 0,
      enrolledLastWeek: 0,
    });
    expect(out?.severity).toBe("info");
  });

  it("info severity (positive note) with active enrollments", () => {
    const out = buildDripHealthInsight({
      activeCount: 5,
      exitedCount: 1,
      completedCount: 2,
      enrolledLastWeek: 2,
    });
    expect(out?.severity).toBe("info");
    expect(out?.description).toMatch(/2 new this week/);
    expect(out?.description).toMatch(/2 completed/);
  });

  it("no-op when only exits/completed but no actives", () => {
    expect(
      buildDripHealthInsight({
        activeCount: 0,
        exitedCount: 2,
        completedCount: 1,
        enrolledLastWeek: 0,
      }),
    ).toBeNull();
  });
});

// ── Past-due commission ────────────────────────────────────────────

describe("buildPastDueCommissionInsight", () => {
  it("returns null when no past-due deals", () => {
    expect(
      buildPastDueCommissionInsight({ pastDueCount: 0, pastDueGross: 0 }),
    ).toBeNull();
  });

  it("warn severity with formatted money in description + metric", () => {
    const out = buildPastDueCommissionInsight({
      pastDueCount: 2,
      pastDueGross: 25_000,
    });
    expect(out?.severity).toBe("warn");
    expect(out?.description).toContain("$25,000");
    expect(out?.metric?.value).toBe("$25,000");
  });

  it("singular copy for pastDueCount=1", () => {
    const out = buildPastDueCommissionInsight({
      pastDueCount: 1,
      pastDueGross: 12_000,
    });
    expect(out?.description).toMatch(/1 active transaction/);
  });
});

// ── Unreplied hot leads ────────────────────────────────────────────

describe("buildUnrepliedHotLeadsInsight", () => {
  it("returns null when no unreplied hot leads", () => {
    expect(
      buildUnrepliedHotLeadsInsight({ count: 0, hours: 24 }),
    ).toBeNull();
  });

  it("warn severity when 1-2 unreplied", () => {
    const out = buildUnrepliedHotLeadsInsight({ count: 2, hours: 24 });
    expect(out?.severity).toBe("warn");
  });

  it("crit severity when 3+ unreplied", () => {
    const out = buildUnrepliedHotLeadsInsight({ count: 5, hours: 24 });
    expect(out?.severity).toBe("crit");
  });

  it("references the lookback window in copy", () => {
    const out = buildUnrepliedHotLeadsInsight({ count: 4, hours: 48 });
    expect(out?.description).toContain("48 hours");
  });
});

// ── sortInsightsBySeverity ─────────────────────────────────────────

describe("sortInsightsBySeverity", () => {
  function ins(id: string, severity: CoachingInsight["severity"]): CoachingInsight {
    return { id, severity, title: id, description: id };
  }

  it("orders crit > warn > info", () => {
    const out = sortInsightsBySeverity([
      ins("c", "info"),
      ins("a", "crit"),
      ins("b", "warn"),
    ]);
    expect(out.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("preserves input order within the same severity (stable)", () => {
    const out = sortInsightsBySeverity([
      ins("first", "warn"),
      ins("second", "warn"),
      ins("third", "warn"),
    ]);
    expect(out.map((x) => x.id)).toEqual(["first", "second", "third"]);
  });

  it("returns a new array (doesn't mutate input)", () => {
    const arr = [ins("a", "info"), ins("b", "crit")];
    const out = sortInsightsBySeverity(arr);
    expect(out).not.toBe(arr);
    expect(arr.map((x) => x.id)).toEqual(["a", "b"]); // unchanged
  });
});
