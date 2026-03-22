import { describe, expect, it } from "vitest";
import { computeHomeValueEstimate } from "../estimateEngine";

describe("computeHomeValueEstimate", () => {
  it("scales baseline PPSF × sqft with adjustments", () => {
    const out = computeHomeValueEstimate(
      {
        baselinePpsf: 300,
        sqft: 2000,
        beds: 3,
        baths: 2,
        propertyType: "single family",
        yearBuilt: 2015,
        lotSqft: 8000,
        condition: "average",
        renovation: "none",
        marketTrend: "stable",
      },
      0.06
    );
    expect(out.point).toBeGreaterThan(300 * 2000 * 0.9);
    expect(out.low).toBeLessThanOrEqual(out.point);
    expect(out.high).toBeGreaterThanOrEqual(out.point);
    expect(out.adjustments.length).toBeGreaterThan(0);
  });
});
