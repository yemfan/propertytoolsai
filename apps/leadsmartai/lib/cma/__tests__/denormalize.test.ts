import { describe, expect, it } from "vitest";

import { denormalize } from "@/lib/cma/denormalize";
import type { CmaSnapshot } from "@/lib/cma/types";

function snapshot(overrides: Partial<CmaSnapshot> = {}): CmaSnapshot {
  return {
    subject: {
      address: "1 Main St",
      beds: 3,
      baths: 2,
      sqft: 1500,
      propertyType: "single_family",
      yearBuilt: 2000,
      condition: "good",
    },
    comps: [],
    valuation: {
      estimatedValue: 500_000,
      low: 470_000,
      high: 530_000,
      avgPricePerSqft: 333,
    },
    strategies: null,
    ...overrides,
  };
}

describe("denormalize", () => {
  it("projects valuation fields onto denormalized columns", () => {
    expect(denormalize(snapshot())).toEqual({
      estimatedValue: 500_000,
      lowEstimate: 470_000,
      highEstimate: 530_000,
      confidenceScore: null,
      compCount: 0,
    });
  });

  it("counts comps in the snapshot", () => {
    const out = denormalize(
      snapshot({
        comps: [
          {
            address: "a",
            price: 1,
            sqft: 1,
            beds: 1,
            baths: 1,
            distanceMiles: 0,
            soldDate: "",
            propertyType: null,
            pricePerSqft: 1,
          },
          {
            address: "b",
            price: 1,
            sqft: 1,
            beds: 1,
            baths: 1,
            distanceMiles: 0,
            soldDate: "",
            propertyType: null,
            pricePerSqft: 1,
          },
        ],
      }),
    );
    expect(out.compCount).toBe(2);
  });

  it("passes through confidenceScore when present", () => {
    const out = denormalize(
      snapshot({
        valuation: {
          estimatedValue: 500_000,
          low: 470_000,
          high: 530_000,
          avgPricePerSqft: 333,
          confidenceScore: 78,
        },
      }),
    );
    expect(out.confidenceScore).toBe(78);
  });

  it("treats non-finite valuation numbers as null (defensive)", () => {
    const out = denormalize(
      snapshot({
        valuation: {
          estimatedValue: Number.NaN,
          low: Number.POSITIVE_INFINITY,
          high: 530_000,
          avgPricePerSqft: 333,
        },
      }),
    );
    expect(out.estimatedValue).toBeNull();
    expect(out.lowEstimate).toBeNull();
    expect(out.highEstimate).toBe(530_000);
  });

  it("handles missing comps array", () => {
    const malformed = {
      ...snapshot(),
      comps: null as unknown as never[],
    };
    const out = denormalize(malformed);
    expect(out.compCount).toBe(0);
  });
});
