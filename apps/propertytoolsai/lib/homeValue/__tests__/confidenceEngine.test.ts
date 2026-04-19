import { describe, expect, it } from "vitest";
import {
  computeConfidenceScoreFromInputs,
  confidenceLevelFromScore,
  scoreAddressQualityFromSignals,
  scoreCompCoverageFromCounts,
  scoreDetailCompletenessFromProperty,
  scoreMarketStabilityFromSignals,
  scoreDataFreshnessFromAgeHours,
  computeConfidence,
  type ConfidenceInputs,
} from "../confidenceEngine";
import type { NormalizedProperty } from "../types";

describe("computeConfidenceScoreFromInputs", () => {
  it("returns 100 when all inputs are 100", () => {
    const inputs: ConfidenceInputs = {
      addressQuality: 100,
      detailCompleteness: 100,
      compCoverage: 100,
      marketStability: 100,
    };
    expect(computeConfidenceScoreFromInputs(inputs)).toBe(100);
  });

  it("returns 0 when all inputs are 0", () => {
    const inputs: ConfidenceInputs = {
      addressQuality: 0,
      detailCompleteness: 0,
      compCoverage: 0,
      marketStability: 0,
    };
    expect(computeConfidenceScoreFromInputs(inputs)).toBe(0);
  });

  it("weights detail and comps more heavily than address and market", () => {
    // Only detail and comp at 100
    const detailComp: ConfidenceInputs = {
      addressQuality: 0,
      detailCompleteness: 100,
      compCoverage: 100,
      marketStability: 0,
    };
    // Only address and market at 100
    const addrMarket: ConfidenceInputs = {
      addressQuality: 100,
      detailCompleteness: 0,
      compCoverage: 0,
      marketStability: 100,
    };
    expect(computeConfidenceScoreFromInputs(detailComp)).toBeGreaterThan(
      computeConfidenceScoreFromInputs(addrMarket)
    );
  });
});

describe("confidenceLevelFromScore", () => {
  it("returns high for 80+", () => {
    expect(confidenceLevelFromScore(80)).toBe("high");
    expect(confidenceLevelFromScore(100)).toBe("high");
  });

  it("returns medium for 55-79", () => {
    expect(confidenceLevelFromScore(55)).toBe("medium");
    expect(confidenceLevelFromScore(79)).toBe("medium");
  });

  it("returns low for 0-54", () => {
    expect(confidenceLevelFromScore(0)).toBe("low");
    expect(confidenceLevelFromScore(54)).toBe("low");
  });
});

describe("scoreAddressQualityFromSignals", () => {
  it("returns 95 for structured address", () => {
    expect(scoreAddressQualityFromSignals("structured")).toBe(95);
  });
  it("returns 68 for partial", () => {
    expect(scoreAddressQualityFromSignals("partial")).toBe(68);
  });
  it("returns 40 for unknown", () => {
    expect(scoreAddressQualityFromSignals("unknown")).toBe(40);
  });
});

describe("scoreCompCoverageFromCounts", () => {
  it("returns 98 for 8+ comps", () => {
    expect(scoreCompCoverageFromCounts(10)).toBe(98);
  });
  it("returns 28 for 0 comps", () => {
    expect(scoreCompCoverageFromCounts(0)).toBe(28);
  });
  it("increases monotonically with comp count", () => {
    const scores = [0, 1, 3, 5, 8].map(scoreCompCoverageFromCounts);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
    }
  });
});

describe("scoreDetailCompletenessFromProperty", () => {
  it("returns 100 when no fields are missing", () => {
    const prop: NormalizedProperty = {
      address: "123 Main St",
      city: "LA",
      state: "CA",
      zip: "90001",
      lat: 34,
      lng: -118,
      beds: 3,
      baths: 2,
      sqft: 2000,
      lotSqft: 6000,
      yearBuilt: 2010,
      propertyType: "single family",
      missingFields: [],
    };
    expect(scoreDetailCompletenessFromProperty(prop)).toBe(100);
  });

  it("returns lower score when fields are missing", () => {
    const prop: NormalizedProperty = {
      address: "123 Main St",
      city: "LA",
      state: "CA",
      zip: "90001",
      lat: 34,
      lng: -118,
      beds: null,
      baths: null,
      sqft: null,
      lotSqft: null,
      yearBuilt: null,
      propertyType: null,
      missingFields: ["beds", "baths", "sqft", "lotSqft", "yearBuilt", "propertyType"],
    };
    expect(scoreDetailCompletenessFromProperty(prop)).toBe(0);
  });
});

describe("scoreDataFreshnessFromAgeHours", () => {
  it("returns 100 for very fresh data (<=6 hours)", () => {
    expect(scoreDataFreshnessFromAgeHours(3)).toBe(100);
  });
  it("returns 70 for null age", () => {
    expect(scoreDataFreshnessFromAgeHours(null)).toBe(70);
  });
  it("returns 45 for stale data (>168 hours)", () => {
    expect(scoreDataFreshnessFromAgeHours(200)).toBe(45);
  });
});

describe("scoreMarketStabilityFromSignals", () => {
  it("returns higher score for stable market", () => {
    const stable = scoreMarketStabilityFromSignals({
      marketTrend: "stable",
      daysOnMarket: 20,
      dataFreshness: 80,
    });
    const down = scoreMarketStabilityFromSignals({
      marketTrend: "down",
      daysOnMarket: 70,
      dataFreshness: 50,
    });
    expect(stable).toBeGreaterThan(down);
  });
});

describe("computeConfidence", () => {
  it("returns confidence object with all expected fields", () => {
    const { confidence, rangeBandPct } = computeConfidence({
      property: {
        address: "123 Main St",
        city: "LA",
        state: "CA",
        zip: "90001",
        lat: 34,
        lng: -118,
        beds: 3,
        baths: 2,
        sqft: 2000,
        lotSqft: 6000,
        yearBuilt: 2010,
        propertyType: "single family",
        missingFields: [],
      },
      pricedCompCount: 6,
      addressQuality: "structured",
      marketTrend: "stable",
      daysOnMarket: 25,
    });

    expect(confidence.level).toMatch(/^(high|medium|low)$/);
    expect(confidence.score).toBeGreaterThanOrEqual(0);
    expect(confidence.score).toBeLessThanOrEqual(100);
    expect(confidence.factors).toHaveLength(4);
    expect(confidence.explanation).toBeTruthy();
    expect(rangeBandPct).toBeGreaterThan(0);
    expect(rangeBandPct).toBeLessThan(0.15);
  });

  it("boosts confidence when micro-market signals are available", () => {
    const baseInput = {
      property: {
        address: "123 Main St",
        city: "LA",
        state: "CA",
        zip: "90001",
        lat: 34,
        lng: -118,
        beds: 3,
        baths: 2,
        sqft: 2000,
        lotSqft: null,
        yearBuilt: null,
        propertyType: null,
        missingFields: ["lotSqft", "yearBuilt", "propertyType"],
      } as NormalizedProperty,
      pricedCompCount: 3,
      addressQuality: "partial" as const,
      marketTrend: "stable" as const,
      daysOnMarket: null,
    };

    const withoutSignals = computeConfidence({ ...baseInput, microMarketSignalCount: 0 });
    const withSignals = computeConfidence({ ...baseInput, microMarketSignalCount: 3 });

    expect(withSignals.confidence.score).toBeGreaterThanOrEqual(
      withoutSignals.confidence.score
    );
  });
});
