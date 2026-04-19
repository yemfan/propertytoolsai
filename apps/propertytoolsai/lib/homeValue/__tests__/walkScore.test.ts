import { describe, expect, it } from "vitest";
import { walkScoreMultiplier } from "../walkScore";

describe("walkScoreMultiplier", () => {
  it("returns neutral when walk score is null", () => {
    const result = walkScoreMultiplier(null);
    expect(result.m).toBe(1);
    expect(result.label).toContain("not available");
  });

  it("returns premium for Walker's Paradise (90+)", () => {
    const result = walkScoreMultiplier(95);
    expect(result.m).toBe(1.03);
    expect(result.label).toContain("Paradise");
  });

  it("returns slight premium for Very Walkable (70-89)", () => {
    const result = walkScoreMultiplier(75);
    expect(result.m).toBe(1.015);
    expect(result.label).toContain("Very Walkable");
  });

  it("returns neutral for Somewhat Walkable (50-69)", () => {
    const result = walkScoreMultiplier(55);
    expect(result.m).toBe(1.0);
  });

  it("returns slight discount for Car-Dependent (25-49)", () => {
    const result = walkScoreMultiplier(30);
    expect(result.m).toBe(0.99);
    expect(result.label).toContain("Car-Dependent");
  });

  it("returns larger discount for very low scores (<25)", () => {
    const result = walkScoreMultiplier(10);
    expect(result.m).toBe(0.98);
  });

  it("handles boundary values correctly", () => {
    expect(walkScoreMultiplier(90).m).toBe(1.03);
    expect(walkScoreMultiplier(89).m).toBe(1.015);
    expect(walkScoreMultiplier(70).m).toBe(1.015);
    expect(walkScoreMultiplier(69).m).toBe(1.0);
    expect(walkScoreMultiplier(50).m).toBe(1.0);
    expect(walkScoreMultiplier(49).m).toBe(0.99);
    expect(walkScoreMultiplier(25).m).toBe(0.99);
    expect(walkScoreMultiplier(24).m).toBe(0.98);
  });
});
