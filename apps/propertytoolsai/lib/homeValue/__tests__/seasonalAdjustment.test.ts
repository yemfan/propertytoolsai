import { describe, expect, it } from "vitest";
import { seasonalMultiplier } from "../seasonalAdjustment";

describe("seasonalMultiplier", () => {
  it("returns highest multiplier for June (peak selling)", () => {
    const result = seasonalMultiplier(6);
    expect(result.m).toBe(1.035);
    expect(result.label).toContain("June");
  });

  it("returns lowest multiplier for December (holiday slowdown)", () => {
    const result = seasonalMultiplier(12);
    expect(result.m).toBe(0.965);
    expect(result.label).toContain("December");
  });

  it("returns near-neutral for September", () => {
    const result = seasonalMultiplier(9);
    expect(result.m).toBe(1.0);
    expect(result.label).toContain("September");
  });

  it("returns above 1.0 for spring/summer months", () => {
    for (const month of [4, 5, 6, 7, 8]) {
      expect(seasonalMultiplier(month).m).toBeGreaterThan(1.0);
    }
  });

  it("returns below 1.0 for winter months", () => {
    for (const month of [1, 2, 11, 12]) {
      expect(seasonalMultiplier(month).m).toBeLessThan(1.0);
    }
  });

  it("defaults to current month when no argument passed", () => {
    const result = seasonalMultiplier();
    expect(result.m).toBeGreaterThan(0.9);
    expect(result.m).toBeLessThan(1.1);
    expect(result.label).toContain("Seasonal adjustment");
  });
});
