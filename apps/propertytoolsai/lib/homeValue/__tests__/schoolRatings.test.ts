import { describe, expect, it } from "vitest";
import { schoolRatingMultiplier, type SchoolRatingResult } from "../schoolRatings";

describe("schoolRatingMultiplier", () => {
  it("returns neutral when rating is null", () => {
    const result = schoolRatingMultiplier({ avgRating: null, schoolCount: 0, source: "none" });
    expect(result.m).toBe(1);
    expect(result.label).toContain("not available");
  });

  it("returns 4% premium for excellent schools (9-10)", () => {
    const result = schoolRatingMultiplier({ avgRating: 9.5, schoolCount: 5, source: "greatschools" });
    expect(result.m).toBe(1.04);
    expect(result.label).toContain("excellent");
  });

  it("returns 2% premium for above-average schools (7-8)", () => {
    const result = schoolRatingMultiplier({ avgRating: 7.5, schoolCount: 4, source: "greatschools" });
    expect(result.m).toBe(1.02);
    expect(result.label).toContain("above average");
  });

  it("returns neutral for average schools (5-6)", () => {
    const result = schoolRatingMultiplier({ avgRating: 5.5, schoolCount: 3, source: "greatschools" });
    expect(result.m).toBe(1.0);
    expect(result.label).toContain("average");
  });

  it("returns 2% discount for below-average schools (3-4)", () => {
    const result = schoolRatingMultiplier({ avgRating: 3.5, schoolCount: 2, source: "greatschools" });
    expect(result.m).toBe(0.98);
    expect(result.label).toContain("below average");
  });

  it("returns 3% discount for low-rated schools (<3)", () => {
    const result = schoolRatingMultiplier({ avgRating: 2, schoolCount: 1, source: "greatschools" });
    expect(result.m).toBe(0.97);
    expect(result.label).toContain("low rated");
  });

  it("handles boundary values correctly", () => {
    expect(schoolRatingMultiplier({ avgRating: 9, schoolCount: 1, source: "greatschools" }).m).toBe(1.04);
    expect(schoolRatingMultiplier({ avgRating: 8.9, schoolCount: 1, source: "greatschools" }).m).toBe(1.02);
    expect(schoolRatingMultiplier({ avgRating: 7, schoolCount: 1, source: "greatschools" }).m).toBe(1.02);
    expect(schoolRatingMultiplier({ avgRating: 6.9, schoolCount: 1, source: "greatschools" }).m).toBe(1.0);
    expect(schoolRatingMultiplier({ avgRating: 5, schoolCount: 1, source: "greatschools" }).m).toBe(1.0);
    expect(schoolRatingMultiplier({ avgRating: 4.9, schoolCount: 1, source: "greatschools" }).m).toBe(0.98);
    expect(schoolRatingMultiplier({ avgRating: 3, schoolCount: 1, source: "greatschools" }).m).toBe(0.98);
    expect(schoolRatingMultiplier({ avgRating: 2.9, schoolCount: 1, source: "greatschools" }).m).toBe(0.97);
  });
});
