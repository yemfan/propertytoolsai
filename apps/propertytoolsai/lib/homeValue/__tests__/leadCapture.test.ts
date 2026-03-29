import { describe, expect, it } from "vitest";
import {
  buildRefineSnapshot,
  canOpenFullReportGate,
  hasRefinedSinceBaseline,
  isUsefulEstimate,
  shouldShowSoftLeadPrompt,
} from "../leadCapture";
import type { HomeValueEstimateResponse } from "../types";

const baseResult = (): HomeValueEstimateResponse => ({
  ok: true,
  sessionId: "s1",
  normalizedProperty: {
    address: "1 Main",
    city: "Austin",
    state: "TX",
    zip: "78701",
    lat: 1,
    lng: 2,
    beds: 3,
    baths: 2,
    sqft: 1800,
    lotSqft: null,
    yearBuilt: 2000,
    propertyType: "single family",
    missingFields: [],
  },
  estimate: {
    point: 500_000,
    low: 450_000,
    high: 550_000,
    baselinePpsf: 200,
    adjustments: [],
    summary: "x",
  },
  confidence: { level: "medium", score: 70, bandPct: 0.1, factors: [], explanation: "" },
  market: { city: "Austin", state: "TX", trend: "stable", medianPrice: null, pricePerSqft: null, source: "x" },
  comps: { pricedCount: 3, totalConsidered: 5 },
  recommendations: [],
  intentInference: {
    likely: "seller",
    scores: { seller: 10, buyer: 0, investor: 0 },
    rationale: [],
    applied: "seller",
  },
});

describe("isUsefulEstimate", () => {
  it("returns false without preview", () => {
    expect(isUsefulEstimate(null)).toBe(false);
  });

  it("returns false for low confidence with no comps", () => {
    const r = baseResult();
    r.confidence = { level: "low", score: 30, bandPct: 0.1, factors: [], explanation: "" };
    r.comps = { pricedCount: 0, totalConsidered: 0 };
    expect(isUsefulEstimate(r)).toBe(false);
  });

  it("returns true for medium confidence", () => {
    expect(isUsefulEstimate(baseResult())).toBe(true);
  });
});

describe("shouldShowSoftLeadPrompt", () => {
  it("never before preview", () => {
    expect(
      shouldShowSoftLeadPrompt({
        reportUnlocked: false,
        hasPreview: false,
        useful: false,
        refined: false,
        bannerDismissed: false,
      })
    ).toBe(false);
  });

  it("shows when useful or refined", () => {
    expect(
      shouldShowSoftLeadPrompt({
        reportUnlocked: false,
        hasPreview: true,
        useful: true,
        refined: false,
        bannerDismissed: false,
      })
    ).toBe(true);
  });
});

describe("canOpenFullReportGate", () => {
  it("requires estimate", () => {
    expect(canOpenFullReportGate(null)).toBe(false);
    expect(canOpenFullReportGate(baseResult())).toBe(true);
  });
});

describe("buildRefineSnapshot / hasRefinedSinceBaseline", () => {
  it("detects refinement", () => {
    const a = buildRefineSnapshot({
      beds: "3",
      baths: "2",
      sqft: "1800",
      lotSqft: "",
      yearBuilt: "",
      propertyType: "single family",
      condition: "average",
      renovation: "none",
    });
    const b = buildRefineSnapshot({
      beds: "4",
      baths: "2",
      sqft: "1800",
      lotSqft: "",
      yearBuilt: "",
      propertyType: "single family",
      condition: "average",
      renovation: "none",
    });
    expect(hasRefinedSinceBaseline(a, b)).toBe(true);
    expect(hasRefinedSinceBaseline(a, a)).toBe(false);
  });
});
