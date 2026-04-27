import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { computeBuyerPrediction } from "@/lib/buyerPrediction/computeScore";
import {
  BUYER_PREDICTION_THRESHOLDS,
  BUYER_PREDICTION_WEIGHTS,
  type BuyerPredictionInput,
} from "@/lib/buyerPrediction/types";

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

function input(overrides: Partial<BuyerPredictionInput> = {}): BuyerPredictionInput {
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

describe("computeBuyerPrediction — overall structure", () => {
  it("returns the five buyer-prediction factors in stable id order", () => {
    const out = computeBuyerPrediction(input());
    expect(out.factors.map((f) => f.id)).toEqual([
      "tenure",
      "buyer_intent_signals",
      "equity_to_upgrade",
      "engagement_uptick",
      "anniversary_dormancy",
    ]);
  });

  it("weights sum to 100 (sanity)", () => {
    const total = Object.values(BUYER_PREDICTION_WEIGHTS).reduce((s, v) => s + v, 0);
    expect(total).toBe(100);
  });

  it("score is bounded 0–100; never exceeds per-factor caps", () => {
    const out = computeBuyerPrediction(
      input({
        homePurchaseDate: isoYearsAgo(7),
        closingPrice: 300_000,
        avmCurrent: 1_500_000,
        avmUpdatedAt: isoDaysAgo(0),
        engagementScore: 200,
        lastActivityAt: isoDaysAgo(0),
        lastContactedAt: isoDaysAgo(365),
        openSignals: [{ type: "job_change", confidence: "high", detectedAt: isoDaysAgo(2) }],
      }),
    );
    expect(out.score).toBeGreaterThanOrEqual(0);
    expect(out.score).toBeLessThanOrEqual(100);
    for (const f of out.factors) {
      expect(f.pointsEarned).toBeLessThanOrEqual(f.pointsMax);
      expect(f.pointsEarned).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("tenure factor", () => {
  it("zero points for <1 year ownership (just settled in)", () => {
    const out = computeBuyerPrediction(input({ homePurchaseDate: isoYearsAgo(0.4) }));
    expect(out.factors[0].pointsEarned).toBe(0);
  });

  it("max points in the 4-9y peak move-up window", () => {
    for (const y of [4.5, 6, 7, 8.5]) {
      const out = computeBuyerPrediction(input({ homePurchaseDate: isoYearsAgo(y) }));
      expect(out.factors[0].pointsEarned).toBe(BUYER_PREDICTION_WEIGHTS.tenure);
    }
  });

  it("baseline 6 points when purchase date is unknown", () => {
    const out = computeBuyerPrediction(input({ homePurchaseDate: null }));
    expect(out.factors[0].pointsEarned).toBe(6);
  });

  it("tenure cap is lower than sphere's 30 (buyer signal is weaker on tenure alone)", () => {
    expect(BUYER_PREDICTION_WEIGHTS.tenure).toBe(25);
    expect(BUYER_PREDICTION_WEIGHTS.tenure).toBeLessThan(30);
  });
});

describe("buyer-intent signals factor", () => {
  it("zero points when no open signals", () => {
    const out = computeBuyerPrediction(input({ openSignals: [] }));
    expect(out.factors[1].pointsEarned).toBe(0);
  });

  it("job_change is the strongest single signal", () => {
    const out = computeBuyerPrediction(
      input({
        openSignals: [{ type: "job_change", confidence: "high", detectedAt: isoDaysAgo(1) }],
      }),
    );
    expect(out.factors[1].pointsEarned).toBe(24);
  });

  it("life_event_other is the second-strongest", () => {
    const out = computeBuyerPrediction(
      input({
        openSignals: [{ type: "life_event_other", confidence: "high", detectedAt: isoDaysAgo(1) }],
      }),
    );
    expect(out.factors[1].pointsEarned).toBe(20);
  });

  it("EXPLICITLY excludes listing_activity (seller-only signal)", () => {
    const out = computeBuyerPrediction(
      input({
        openSignals: [{ type: "listing_activity", confidence: "high", detectedAt: isoDaysAgo(1) }],
      }),
    );
    expect(out.factors[1].pointsEarned).toBe(0);
    expect(out.factors[1].detail).toMatch(/none predict buying/i);
  });

  it("low-confidence signals score less than high-confidence", () => {
    const high = computeBuyerPrediction(
      input({
        openSignals: [{ type: "job_change", confidence: "high", detectedAt: isoDaysAgo(1) }],
      }),
    );
    const low = computeBuyerPrediction(
      input({
        openSignals: [{ type: "job_change", confidence: "low", detectedAt: isoDaysAgo(1) }],
      }),
    );
    expect(low.factors[1].pointsEarned).toBeLessThan(high.factors[1].pointsEarned);
  });

  it("does not compound — multiple weak signals do not exceed one strong signal", () => {
    const oneStrong = computeBuyerPrediction(
      input({
        openSignals: [{ type: "job_change", confidence: "high", detectedAt: isoDaysAgo(1) }],
      }),
    );
    const manyWeak = computeBuyerPrediction(
      input({
        openSignals: [
          { type: "anniversary_due", confidence: "low", detectedAt: isoDaysAgo(1) },
          { type: "anniversary_due", confidence: "low", detectedAt: isoDaysAgo(2) },
          { type: "anniversary_due", confidence: "low", detectedAt: isoDaysAgo(3) },
        ],
      }),
    );
    expect(manyWeak.factors[1].pointsEarned).toBeLessThan(oneStrong.factors[1].pointsEarned);
  });

  it("ignores listing_activity even when it's the only signal present", () => {
    const out = computeBuyerPrediction(
      input({
        openSignals: [
          { type: "listing_activity", confidence: "high", detectedAt: isoDaysAgo(1) },
          { type: "listing_activity", confidence: "high", detectedAt: isoDaysAgo(2) },
        ],
      }),
    );
    expect(out.factors[1].pointsEarned).toBe(0);
  });

  it("picks job_change over equity_milestone when both present", () => {
    const out = computeBuyerPrediction(
      input({
        openSignals: [
          { type: "equity_milestone", confidence: "high", detectedAt: isoDaysAgo(1) },
          { type: "job_change", confidence: "high", detectedAt: isoDaysAgo(2) },
        ],
      }),
    );
    expect(out.factors[1].detail).toContain("job change");
  });
});

describe("equity-to-upgrade factor", () => {
  it("returns neutral baseline when prices are missing", () => {
    expect(computeBuyerPrediction(input({ closingPrice: 500_000 })).factors[2].pointsEarned).toBe(5);
    expect(computeBuyerPrediction(input({ avmCurrent: 800_000 })).factors[2].pointsEarned).toBe(5);
  });

  it("max points for big equity gain", () => {
    const out = computeBuyerPrediction(
      input({
        closingPrice: 400_000,
        avmCurrent: 700_000, // 75% / $300K gain
        avmUpdatedAt: isoDaysAgo(0),
      }),
    );
    expect(out.factors[2].pointsEarned).toBe(BUYER_PREDICTION_WEIGHTS.equity_to_upgrade);
  });

  it("zero points for negative equity (no upgrade afford)", () => {
    const out = computeBuyerPrediction(
      input({
        closingPrice: 800_000,
        avmCurrent: 700_000,
        avmUpdatedAt: isoDaysAgo(0),
      }),
    );
    expect(out.factors[2].pointsEarned).toBe(0);
  });

  it("buyer cap is 20 (lower than sphere's 25 — equity is permission, not intent)", () => {
    expect(BUYER_PREDICTION_WEIGHTS.equity_to_upgrade).toBe(20);
    expect(BUYER_PREDICTION_WEIGHTS.equity_to_upgrade).toBeLessThan(25);
  });

  it("stale AVM (>1y) discounts the signal", () => {
    const fresh = computeBuyerPrediction(
      input({ closingPrice: 400_000, avmCurrent: 800_000, avmUpdatedAt: isoDaysAgo(0) }),
    );
    const stale = computeBuyerPrediction(
      input({ closingPrice: 400_000, avmCurrent: 800_000, avmUpdatedAt: isoDaysAgo(500) }),
    );
    expect(stale.factors[2].pointsEarned).toBeLessThan(fresh.factors[2].pointsEarned);
    expect(stale.factors[2].detail).toContain("discounted");
  });
});

describe("engagement uptick factor", () => {
  it("zero points when no recent activity", () => {
    const out = computeBuyerPrediction(input({ engagementScore: 100, lastActivityAt: null }));
    expect(out.factors[3].pointsEarned).toBe(0);
  });

  it("max points for very fresh activity + high engagement", () => {
    const out = computeBuyerPrediction(
      input({ engagementScore: 80, lastActivityAt: isoDaysAgo(2) }),
    );
    expect(out.factors[3].pointsEarned).toBe(BUYER_PREDICTION_WEIGHTS.engagement_uptick);
  });
});

describe("anniversary / dormancy factor", () => {
  it("rewards 5/7/10y anniversaries", () => {
    for (const y of [5, 7, 10]) {
      const out = computeBuyerPrediction(input({ homePurchaseDate: isoYearsAgo(y) }));
      expect(out.factors[4].pointsEarned).toBeGreaterThanOrEqual(8);
    }
  });

  it("rewards re-emerging from long dormancy", () => {
    const out = computeBuyerPrediction(
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
  it("labels >=70 as high (job_change + tenure peak + equity + engagement)", () => {
    const out = computeBuyerPrediction(
      input({
        homePurchaseDate: isoYearsAgo(7),
        closingPrice: 400_000,
        avmCurrent: 700_000,
        avmUpdatedAt: isoDaysAgo(0),
        engagementScore: 80,
        lastActivityAt: isoDaysAgo(2),
        openSignals: [{ type: "job_change", confidence: "high", detectedAt: isoDaysAgo(1) }],
      }),
    );
    expect(out.score).toBeGreaterThanOrEqual(BUYER_PREDICTION_THRESHOLDS.highMin);
    expect(out.label).toBe("high");
  });

  it("labels <40 as low (default empty input)", () => {
    expect(computeBuyerPrediction(input()).label).toBe("low");
  });
});
