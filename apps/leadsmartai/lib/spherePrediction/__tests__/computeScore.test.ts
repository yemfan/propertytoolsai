import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { computeSphereSellerPrediction } from "@/lib/spherePrediction/computeScore";
import {
  SPHERE_SELLER_THRESHOLDS,
  SPHERE_SELLER_WEIGHTS,
  type SphereSellerInput,
} from "@/lib/spherePrediction/types";

// All tests pin Date.now() to 2026-04-26 (today, per session context). This
// keeps tenure / dormancy / anniversary calculations deterministic across
// machines + future re-runs.
const FIXED_NOW = new Date("2026-04-26T12:00:00Z").getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function isoYearsAgo(years: number): string {
  return new Date(FIXED_NOW - years * 365.25 * 86_400_000).toISOString();
}

function isoDaysAgo(days: number): string {
  return new Date(FIXED_NOW - days * 86_400_000).toISOString();
}

function input(overrides: Partial<SphereSellerInput> = {}): SphereSellerInput {
  return {
    homePurchaseDate: null,
    closingPrice: null,
    avmCurrent: null,
    avmUpdatedAt: null,
    engagementScore: 0,
    lastActivityAt: null,
    lastContactedAt: null,
    openSignals: [],
    relationshipType: null,
    ...overrides,
  };
}

describe("computeSphereSellerPrediction — overall structure", () => {
  it("returns the five named factors in stable id order", () => {
    const out = computeSphereSellerPrediction(input());
    expect(out.factors.map((f) => f.id)).toEqual([
      "tenure",
      "equity_gain",
      "open_signals",
      "engagement_uptick",
      "anniversary_dormancy",
    ]);
  });

  it("never exceeds the per-factor cap", () => {
    const out = computeSphereSellerPrediction(
      input({
        homePurchaseDate: isoYearsAgo(7),
        closingPrice: 300000,
        avmCurrent: 1_000_000,
        avmUpdatedAt: isoDaysAgo(0),
        engagementScore: 200,
        lastActivityAt: isoDaysAgo(0),
        lastContactedAt: isoDaysAgo(365),
        openSignals: [{ type: "listing_activity", confidence: "high", detectedAt: isoDaysAgo(2) }],
      }),
    );
    for (const f of out.factors) {
      expect(f.pointsEarned).toBeLessThanOrEqual(f.pointsMax);
      expect(f.pointsEarned).toBeGreaterThanOrEqual(0);
    }
  });

  it("score is bounded 0–100", () => {
    const empty = computeSphereSellerPrediction(input());
    expect(empty.score).toBeGreaterThanOrEqual(0);
    expect(empty.score).toBeLessThanOrEqual(100);

    const max = computeSphereSellerPrediction(
      input({
        homePurchaseDate: isoYearsAgo(7),
        closingPrice: 300000,
        avmCurrent: 1_500_000,
        avmUpdatedAt: isoDaysAgo(0),
        engagementScore: 200,
        lastActivityAt: isoDaysAgo(0),
        lastContactedAt: isoDaysAgo(365),
        openSignals: [{ type: "listing_activity", confidence: "high", detectedAt: isoDaysAgo(0) }],
      }),
    );
    expect(max.score).toBeLessThanOrEqual(100);
  });

  it("weights sum to 100 (sanity)", () => {
    const total = Object.values(SPHERE_SELLER_WEIGHTS).reduce((s, v) => s + v, 0);
    expect(total).toBe(100);
  });
});

describe("tenure factor", () => {
  it("zero points for <1 year ownership", () => {
    const out = computeSphereSellerPrediction(input({ homePurchaseDate: isoYearsAgo(0.4) }));
    expect(out.factors[0].pointsEarned).toBe(0);
  });

  it("max points in the 4–9 year peak window", () => {
    for (const y of [4.5, 6, 7, 8.5]) {
      const out = computeSphereSellerPrediction(input({ homePurchaseDate: isoYearsAgo(y) }));
      expect(out.factors[0].pointsEarned).toBe(SPHERE_SELLER_WEIGHTS.tenure);
    }
  });

  it("partial points for adjacent windows", () => {
    const w2 = computeSphereSellerPrediction(input({ homePurchaseDate: isoYearsAgo(2.5) }));
    const w11 = computeSphereSellerPrediction(input({ homePurchaseDate: isoYearsAgo(11) }));
    expect(w2.factors[0].pointsEarned).toBe(16);
    expect(w11.factors[0].pointsEarned).toBe(22);
  });

  it("baseline 8 points when purchase date is unknown (does not zero out)", () => {
    const out = computeSphereSellerPrediction(input({ homePurchaseDate: null }));
    expect(out.factors[0].pointsEarned).toBe(8);
  });

  it("low points for very long tenure (>20y)", () => {
    const out = computeSphereSellerPrediction(input({ homePurchaseDate: isoYearsAgo(25) }));
    expect(out.factors[0].pointsEarned).toBe(8);
  });
});

describe("equity factor", () => {
  it("returns neutral baseline when closing price or AVM missing", () => {
    expect(computeSphereSellerPrediction(input({ closingPrice: 500000 })).factors[1].pointsEarned)
      .toBe(6);
    expect(computeSphereSellerPrediction(input({ avmCurrent: 800000 })).factors[1].pointsEarned)
      .toBe(6);
  });

  it("max points for huge equity gain", () => {
    const out = computeSphereSellerPrediction(
      input({
        closingPrice: 400000,
        avmCurrent: 1_200_000,
        avmUpdatedAt: isoDaysAgo(0),
      }),
    );
    expect(out.factors[1].pointsEarned).toBe(SPHERE_SELLER_WEIGHTS.equity_gain);
    expect(out.factors[1].detail).toContain("$800,000");
  });

  it("scales partial points for moderate equity", () => {
    // 12% gain → 8-pt tier
    const small = computeSphereSellerPrediction(
      input({ closingPrice: 500000, avmCurrent: 560000, avmUpdatedAt: isoDaysAgo(0) }),
    );
    expect(small.factors[1].pointsEarned).toBe(8);

    // 30% gain ($150K) → 14-pt tier
    const moderate = computeSphereSellerPrediction(
      input({ closingPrice: 500000, avmCurrent: 650000, avmUpdatedAt: isoDaysAgo(0) }),
    );
    expect(moderate.factors[1].pointsEarned).toBe(14);

    // 40% gain ($200K) → 20-pt tier
    const strong = computeSphereSellerPrediction(
      input({ closingPrice: 500000, avmCurrent: 700000, avmUpdatedAt: isoDaysAgo(0) }),
    );
    expect(strong.factors[1].pointsEarned).toBe(20);
  });

  it("zero points for negative equity (underwater)", () => {
    const out = computeSphereSellerPrediction(
      input({ closingPrice: 800000, avmCurrent: 700000, avmUpdatedAt: isoDaysAgo(0) }),
    );
    expect(out.factors[1].pointsEarned).toBe(0);
  });

  it("stale AVM (>1y) discounts the signal by ~50%", () => {
    const fresh = computeSphereSellerPrediction(
      input({ closingPrice: 400000, avmCurrent: 800000, avmUpdatedAt: isoDaysAgo(0) }),
    );
    const stale = computeSphereSellerPrediction(
      input({ closingPrice: 400000, avmCurrent: 800000, avmUpdatedAt: isoDaysAgo(500) }),
    );
    expect(stale.factors[1].pointsEarned).toBeLessThan(fresh.factors[1].pointsEarned);
    expect(stale.factors[1].detail).toContain("discounted");
  });
});

describe("open signals factor", () => {
  it("zero points when no open signals", () => {
    const out = computeSphereSellerPrediction(input({ openSignals: [] }));
    expect(out.factors[2].pointsEarned).toBe(0);
  });

  it("listing_activity high-confidence is the strongest single signal", () => {
    const out = computeSphereSellerPrediction(
      input({
        openSignals: [{ type: "listing_activity", confidence: "high", detectedAt: isoDaysAgo(1) }],
      }),
    );
    expect(out.factors[2].pointsEarned).toBe(SPHERE_SELLER_WEIGHTS.open_signals);
  });

  it("low-confidence signals score less than high-confidence", () => {
    const high = computeSphereSellerPrediction(
      input({
        openSignals: [{ type: "equity_milestone", confidence: "high", detectedAt: isoDaysAgo(1) }],
      }),
    );
    const low = computeSphereSellerPrediction(
      input({
        openSignals: [{ type: "equity_milestone", confidence: "low", detectedAt: isoDaysAgo(1) }],
      }),
    );
    expect(low.factors[2].pointsEarned).toBeLessThan(high.factors[2].pointsEarned);
  });

  it("does not compound — multiple weak signals do not exceed one strong signal", () => {
    const oneStrong = computeSphereSellerPrediction(
      input({
        openSignals: [{ type: "listing_activity", confidence: "high", detectedAt: isoDaysAgo(1) }],
      }),
    );
    const manyWeak = computeSphereSellerPrediction(
      input({
        openSignals: [
          { type: "anniversary_due", confidence: "low", detectedAt: isoDaysAgo(1) },
          { type: "anniversary_due", confidence: "low", detectedAt: isoDaysAgo(2) },
          { type: "anniversary_due", confidence: "low", detectedAt: isoDaysAgo(3) },
        ],
      }),
    );
    expect(manyWeak.factors[2].pointsEarned).toBeLessThan(oneStrong.factors[2].pointsEarned);
  });
});

describe("engagement uptick factor", () => {
  it("zero points when there is no recent activity", () => {
    const out = computeSphereSellerPrediction(input({ engagementScore: 100, lastActivityAt: null }));
    expect(out.factors[3].pointsEarned).toBe(0);
  });

  it("max points for very fresh activity + high engagement", () => {
    const out = computeSphereSellerPrediction(
      input({ engagementScore: 80, lastActivityAt: isoDaysAgo(2) }),
    );
    expect(out.factors[3].pointsEarned).toBe(SPHERE_SELLER_WEIGHTS.engagement_uptick);
  });

  it("scales down for stale activity", () => {
    const fresh = computeSphereSellerPrediction(
      input({ engagementScore: 50, lastActivityAt: isoDaysAgo(5) }),
    );
    const stale = computeSphereSellerPrediction(
      input({ engagementScore: 50, lastActivityAt: isoDaysAgo(25) }),
    );
    expect(stale.factors[3].pointsEarned).toBeLessThan(fresh.factors[3].pointsEarned);
  });
});

describe("anniversary / dormancy factor", () => {
  it("rewards 5/7/10-year anniversaries highest", () => {
    for (const y of [5, 7, 10]) {
      const out = computeSphereSellerPrediction(input({ homePurchaseDate: isoYearsAgo(y) }));
      // 8 points for primary anniversary
      expect(out.factors[4].pointsEarned).toBeGreaterThanOrEqual(8);
    }
  });

  it("does not reward off-anniversary years", () => {
    const out = computeSphereSellerPrediction(input({ homePurchaseDate: isoYearsAgo(6.5) }));
    expect(out.factors[4].pointsEarned).toBe(0);
  });

  it("rewards re-emerging from long dormancy", () => {
    const out = computeSphereSellerPrediction(
      input({
        homePurchaseDate: null,
        lastContactedAt: isoDaysAgo(220),
        lastActivityAt: isoDaysAgo(5),
      }),
    );
    expect(out.factors[4].pointsEarned).toBeGreaterThanOrEqual(4);
    expect(out.factors[4].detail).toContain("dormancy");
  });
});

describe("label thresholds", () => {
  it("labels >=70 as high", () => {
    const out = computeSphereSellerPrediction(
      input({
        homePurchaseDate: isoYearsAgo(7),
        closingPrice: 400000,
        avmCurrent: 1_000_000,
        avmUpdatedAt: isoDaysAgo(0),
        engagementScore: 80,
        lastActivityAt: isoDaysAgo(2),
        openSignals: [{ type: "listing_activity", confidence: "high", detectedAt: isoDaysAgo(1) }],
      }),
    );
    expect(out.score).toBeGreaterThanOrEqual(SPHERE_SELLER_THRESHOLDS.highMin);
    expect(out.label).toBe("high");
  });

  it("labels 40-69 as medium", () => {
    const out = computeSphereSellerPrediction(
      input({
        homePurchaseDate: isoYearsAgo(7),
        closingPrice: 500000,
        avmCurrent: 600000,
        avmUpdatedAt: isoDaysAgo(0),
        engagementScore: 30,
        lastActivityAt: isoDaysAgo(20),
      }),
    );
    expect(out.label).toBe("medium");
  });

  it("labels <40 as low", () => {
    const out = computeSphereSellerPrediction(input());
    expect(out.label).toBe("low");
  });
});
