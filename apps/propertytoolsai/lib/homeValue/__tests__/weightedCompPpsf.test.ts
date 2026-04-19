import { describe, expect, it } from "vitest";
import { computeWeightedCompPpsf, type CompWeightInput } from "../weightedCompPpsf";

function comp(overrides: Partial<CompWeightInput> = {}): CompWeightInput {
  return {
    soldPrice: 1_000_000,
    sqft: 2_000,
    soldDate: new Date().toISOString(),
    distanceMiles: 1,
    beds: 3,
    baths: 2,
    yearBuilt: 2000,
    ...overrides,
  };
}

const subject = { beds: 3, baths: 2, sqft: 2000, yearBuilt: 2000 };

describe("computeWeightedCompPpsf outlier trimming", () => {
  it("returns null for an empty comp list", () => {
    expect(computeWeightedCompPpsf([], subject)).toBeNull();
  });

  it("leaves the set untouched when fewer than MIN comps (below threshold)", () => {
    // 3 comps — below the 4-comp threshold. No outlier trimming.
    const result = computeWeightedCompPpsf(
      [
        comp({ soldPrice: 500_000, sqft: 1000 }),   // $500/sqft
        comp({ soldPrice: 600_000, sqft: 1000 }),   // $600/sqft
        comp({ soldPrice: 10_000_000, sqft: 1000 }),// $10,000/sqft (outlier, but kept)
      ],
      subject
    );
    expect(result).not.toBeNull();
    expect(result!.compCount).toBe(3);
    expect(result!.outliersDropped).toBe(0);
  });

  it("drops comps whose PPSF is >1.75× median", () => {
    const result = computeWeightedCompPpsf(
      [
        comp({ soldPrice: 500_000, sqft: 1000 }),  // $500
        comp({ soldPrice: 550_000, sqft: 1000 }),  // $550
        comp({ soldPrice: 600_000, sqft: 1000 }),  // $600 ← median-ish
        comp({ soldPrice: 650_000, sqft: 1000 }),  // $650
        comp({ soldPrice: 5_000_000, sqft: 1000 }),// $5000 (mansion outlier)
      ],
      subject
    );
    expect(result).not.toBeNull();
    expect(result!.outliersDropped).toBe(1);
    expect(result!.compCount).toBe(4);
    // The weighted PPSF should be near $575, not dragged way up by the outlier.
    expect(result!.weightedPpsf).toBeGreaterThan(400);
    expect(result!.weightedPpsf).toBeLessThan(800);
  });

  it("drops comps whose PPSF is <0.5× median (tiny-condo scenario)", () => {
    // Median is around $600. A $200 comp (~0.33×) should be dropped.
    const result = computeWeightedCompPpsf(
      [
        comp({ soldPrice: 500_000, sqft: 1000 }),  // $500
        comp({ soldPrice: 550_000, sqft: 1000 }),  // $550
        comp({ soldPrice: 600_000, sqft: 1000 }),  // $600
        comp({ soldPrice: 650_000, sqft: 1000 }),  // $650
        comp({ soldPrice: 200_000, sqft: 1000 }),  // $200 (tiny-condo outlier)
      ],
      subject
    );
    expect(result).not.toBeNull();
    expect(result!.outliersDropped).toBe(1);
    expect(result!.compCount).toBe(4);
  });

  it("preserves reasonable spread (no false positives near median)", () => {
    // All within 1.0–1.4× of each other — nothing should be dropped.
    const result = computeWeightedCompPpsf(
      [
        comp({ soldPrice: 500_000, sqft: 1000 }),
        comp({ soldPrice: 600_000, sqft: 1000 }),
        comp({ soldPrice: 700_000, sqft: 1000 }),
        comp({ soldPrice: 550_000, sqft: 1000 }),
        comp({ soldPrice: 650_000, sqft: 1000 }),
      ],
      subject
    );
    expect(result).not.toBeNull();
    expect(result!.outliersDropped).toBe(0);
    expect(result!.compCount).toBe(5);
  });

  it("skips comps with invalid sqft or price", () => {
    const result = computeWeightedCompPpsf(
      [
        comp({ soldPrice: 500_000, sqft: 1000 }),
        comp({ soldPrice: 0, sqft: 1000 }),       // invalid price
        comp({ soldPrice: 500_000, sqft: 0 }),    // invalid sqft
      ],
      subject
    );
    expect(result).not.toBeNull();
    expect(result!.compCount).toBe(1);
  });
});
