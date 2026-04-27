import { describe, expect, it } from "vitest";

import {
  buildListingStrategyBands,
  formatBandTag,
  type ListingStrategyBand,
} from "@/lib/cma/listingStrategy";
import type { CmaStrategy, CmaValuation } from "@/lib/cma/types";

const VALUATION: CmaValuation = {
  estimatedValue: 500_000,
  low: 470_000,
  high: 530_000,
  avgPricePerSqft: 250,
};

function strategy(overrides: Partial<CmaStrategy> = {}): CmaStrategy {
  return {
    aggressive: 480_000,
    market: 500_000,
    premium: 520_000,
    daysOnMarket: { aggressive: 5, market: 14, premium: 28 },
    ...overrides,
  };
}

describe("buildListingStrategyBands — with engine strategies", () => {
  it("returns 3 bands in aggressive → market → premium order", () => {
    const bands = buildListingStrategyBands(strategy(), VALUATION);
    expect(bands.map((b) => b.key)).toEqual(["aggressive", "market", "premium"]);
  });

  it("uses the engine's prices (rounded to whole dollars)", () => {
    const bands = buildListingStrategyBands(
      strategy({ aggressive: 480_000.4, market: 500_000.6, premium: 520_000.5 }),
      VALUATION,
    );
    expect(bands.map((b) => b.price)).toEqual([480_000, 500_001, 520_001]);
  });

  it("passes through expectedDom from engine", () => {
    const bands = buildListingStrategyBands(strategy(), VALUATION);
    expect(bands.map((b) => b.expectedDom)).toEqual([5, 14, 28]);
  });

  it("rationale is band-specific (not a generic placeholder)", () => {
    const bands = buildListingStrategyBands(strategy(), VALUATION);
    const rationales = bands.map((b) => b.rationale);
    expect(new Set(rationales).size).toBe(3); // all distinct
    expect(rationales[0]).toMatch(/multiple offers|fast/i);
    expect(rationales[2]).toMatch(/stretch|premium|above/i);
  });
});

describe("buildListingStrategyBands — fallback when engine omits strategies", () => {
  it("derives bands from valuation.estimatedValue using ±4%", () => {
    const bands = buildListingStrategyBands(null, VALUATION);
    expect(bands.map((b) => b.price)).toEqual([
      Math.round(500_000 * 0.96),
      500_000,
      Math.round(500_000 * 1.04),
    ]);
  });

  it("expectedDom is null in the fallback (engine never returned one)", () => {
    const bands = buildListingStrategyBands(null, VALUATION);
    expect(bands.map((b) => b.expectedDom)).toEqual([null, null, null]);
  });

  it("treats undefined strategies same as null", () => {
    const bands = buildListingStrategyBands(undefined, VALUATION);
    expect(bands).toHaveLength(3);
    expect(bands[0].expectedDom).toBeNull();
  });

  it("clamps a negative estimate to 0 to avoid weird negative bands", () => {
    const bands = buildListingStrategyBands(null, {
      ...VALUATION,
      estimatedValue: -50_000,
    });
    expect(bands.map((b) => b.price)).toEqual([0, 0, 0]);
  });

  it("infinite/NaN estimate produces 0 prices, not NaN", () => {
    const bands = buildListingStrategyBands(null, {
      ...VALUATION,
      estimatedValue: Number.POSITIVE_INFINITY,
    });
    expect(bands.every((b) => b.price === 0)).toBe(true);
  });
});

describe("buildListingStrategyBands — partial DOM data", () => {
  it("handles missing per-band DOM values defensively", () => {
    const bands = buildListingStrategyBands(
      // @ts-expect-error — simulate an older engine response missing market DOM
      { ...strategy(), daysOnMarket: { aggressive: 7 } },
      VALUATION,
    );
    expect(bands[0].expectedDom).toBe(7);
    expect(bands[1].expectedDom).toBeNull();
    expect(bands[2].expectedDom).toBeNull();
  });
});

describe("formatBandTag", () => {
  function band(overrides: Partial<ListingStrategyBand> = {}): ListingStrategyBand {
    return {
      key: "market",
      label: "Market",
      price: 500_000,
      expectedDom: 14,
      rationale: "x",
      ...overrides,
    };
  }

  it("formats 'Label · {dom}d' when DOM is present", () => {
    expect(formatBandTag(band({ label: "Aggressive", expectedDom: 5 }))).toBe(
      "Aggressive · 5d",
    );
  });

  it("formats 'Label · est.' when DOM is null", () => {
    expect(formatBandTag(band({ label: "Premium", expectedDom: null }))).toBe(
      "Premium · est.",
    );
  });
});
