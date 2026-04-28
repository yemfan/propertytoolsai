import { describe, expect, it } from "vitest";

import {
  computeDismissedUntil,
  DEFAULT_DISMISS_DURATION_DAYS,
  filterDismissedInsights,
  type CoachingDismissal,
} from "@/lib/coaching/dismissals";
import type { CoachingInsight } from "@/lib/coaching/insights";

const NOW = "2026-04-28T12:00:00.000Z";

function insight(id: string, severity: CoachingInsight["severity"] = "info"): CoachingInsight {
  return { id, severity, title: id, description: id };
}

describe("computeDismissedUntil", () => {
  it("defaults to 7 days when no `days` supplied", () => {
    const out = computeDismissedUntil({ nowIso: NOW });
    const expected = new Date(
      Date.parse(NOW) + DEFAULT_DISMISS_DURATION_DAYS * 86_400_000,
    ).toISOString();
    expect(out).toBe(expected);
  });

  it("uses the supplied days override", () => {
    const out = computeDismissedUntil({ nowIso: NOW, days: 14 });
    const expected = new Date(Date.parse(NOW) + 14 * 86_400_000).toISOString();
    expect(out).toBe(expected);
  });

  it("clamps to a 1-day minimum (no zero / negative)", () => {
    expect(computeDismissedUntil({ nowIso: NOW, days: 0 })).toBe(
      new Date(Date.parse(NOW) + 1 * 86_400_000).toISOString(),
    );
    expect(computeDismissedUntil({ nowIso: NOW, days: -3 })).toBe(
      new Date(Date.parse(NOW) + 1 * 86_400_000).toISOString(),
    );
  });

  it("clamps to a 30-day maximum", () => {
    expect(computeDismissedUntil({ nowIso: NOW, days: 365 })).toBe(
      new Date(Date.parse(NOW) + 30 * 86_400_000).toISOString(),
    );
  });

  it("rounds fractional days to the nearest integer", () => {
    expect(computeDismissedUntil({ nowIso: NOW, days: 6.7 })).toBe(
      new Date(Date.parse(NOW) + 7 * 86_400_000).toISOString(),
    );
  });

  it("handles unparseable nowIso defensively (returns input)", () => {
    expect(computeDismissedUntil({ nowIso: "not-a-date" })).toBe("not-a-date");
  });
});

describe("filterDismissedInsights", () => {
  function active(id: string): CoachingDismissal {
    return {
      insightId: id,
      dismissedUntil: new Date(Date.parse(NOW) + 86_400_000).toISOString(),
    };
  }
  function expired(id: string): CoachingDismissal {
    return {
      insightId: id,
      dismissedUntil: new Date(Date.parse(NOW) - 86_400_000).toISOString(),
    };
  }

  it("returns the input untouched when no dismissals", () => {
    const insights = [insight("a"), insight("b")];
    expect(filterDismissedInsights(insights, [], NOW)).toEqual(insights);
  });

  it("drops insights that have an active dismissal", () => {
    const out = filterDismissedInsights(
      [insight("a"), insight("b"), insight("c")],
      [active("b")],
      NOW,
    );
    expect(out.map((i) => i.id)).toEqual(["a", "c"]);
  });

  it("ignores expired dismissals (insight still surfaces)", () => {
    const out = filterDismissedInsights(
      [insight("a"), insight("b")],
      [expired("a")],
      NOW,
    );
    expect(out.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("handles a mix of active + expired dismissals", () => {
    const out = filterDismissedInsights(
      [insight("a"), insight("b"), insight("c")],
      [active("a"), expired("b"), active("c")],
      NOW,
    );
    expect(out.map((i) => i.id)).toEqual(["b"]);
  });

  it("returns a NEW array even when no dismissals match (doesn't mutate input)", () => {
    const insights = [insight("a")];
    const out = filterDismissedInsights(insights, [], NOW);
    expect(out).not.toBe(insights);
  });

  it("dismissal at exact NOW boundary stays expired (>= now is required to hide)", () => {
    const dismissal: CoachingDismissal = {
      insightId: "a",
      dismissedUntil: NOW, // exactly now, not strictly future
    };
    const out = filterDismissedInsights([insight("a")], [dismissal], NOW);
    expect(out.map((i) => i.id)).toEqual(["a"]);
  });
});
