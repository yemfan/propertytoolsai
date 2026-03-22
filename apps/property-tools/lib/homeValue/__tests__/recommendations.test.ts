import { describe, expect, it } from "vitest";
import { buildHomeValueRecommendations, getToolkitRecommendations } from "../recommendations";

const baseEstimate = {
  point: 500_000,
  low: 450_000,
  high: 550_000,
  baselinePpsf: 250,
  adjustments: [],
  summary: "Test",
};

const baseConfidence = {
  level: "medium" as const,
  score: 65,
  bandPct: 0.1,
  factors: [],
  explanation: "",
};

describe("buildHomeValueRecommendations", () => {
  it("returns three seller items with expected titles", () => {
    const r = buildHomeValueRecommendations({
      intent: "seller",
      estimate: baseEstimate,
      confidence: baseConfidence,
      comps: { pricedCount: 4, totalConsidered: 8 },
      market: {
        city: "Austin",
        state: "TX",
        trend: "up",
        medianPrice: 400_000,
        pricePerSqft: 250,
        source: "city",
      },
    });
    expect(r).toHaveLength(3);
    expect(r[0].title).toBe("Get a detailed CMA report");
    expect(r[0].href).toContain("smart-cma");
    expect(r[1].title).toBe("Compare your home with recent sales nearby");
    expect(r[2].title).toBe("Talk to a local listing expert");
  });

  it("returns three buyer items with expected titles", () => {
    const r = buildHomeValueRecommendations({
      intent: "buyer",
      estimate: baseEstimate,
      confidence: baseConfidence,
      comps: { pricedCount: 2, totalConsidered: 6 },
      market: {
        city: "Denver",
        state: "CO",
        trend: "stable",
        medianPrice: null,
        pricePerSqft: 300,
        source: "city",
      },
    });
    expect(r.map((x) => x.title)).toEqual([
      "Estimate mortgage for this property",
      "Compare this home with similar options",
      "See AI-recommended alternatives nearby",
    ]);
  });

  it("returns three investor items with expected titles", () => {
    const r = buildHomeValueRecommendations({
      intent: "investor",
      estimate: baseEstimate,
      confidence: baseConfidence,
      comps: { pricedCount: 1, totalConsidered: 4 },
      market: {
        city: "Tampa",
        state: "FL",
        trend: "down",
        medianPrice: 350_000,
        pricePerSqft: 200,
        source: "city",
      },
      propertyType: "single family",
    });
    expect(r.map((x) => x.title)).toEqual([
      "Estimate rental income",
      "Analyze ROI and cash flow",
      "Use AI Property Comparison for deal ranking",
    ]);
    expect(r[1].href).toContain("cap-rate");
  });

  it("mentions missing fields in reasons when provided", () => {
    const r = buildHomeValueRecommendations({
      intent: "seller",
      estimate: baseEstimate,
      confidence: baseConfidence,
      comps: { pricedCount: 0, totalConsidered: 0 },
      market: {
        city: "X",
        state: "Y",
        trend: "stable",
        medianPrice: null,
        pricePerSqft: null,
        source: "x",
      },
      normalizedProperty: { missingFields: ["sqft", "yearBuilt"] },
    });
    expect(r[0].reason).toMatch(/2 details are still missing/i);
  });
});

describe("getToolkitRecommendations (legacy)", () => {
  it("returns three items for seller", () => {
    expect(getToolkitRecommendations("seller")).toHaveLength(3);
  });
});
