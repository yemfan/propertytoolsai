import { describe, expect, it } from "vitest";
import { floodZoneMultiplier, type FloodZoneResult } from "../floodZone";

describe("floodZoneMultiplier", () => {
  it("returns neutral when zone is null", () => {
    const result = floodZoneMultiplier({ zone: null, highRisk: false, moderateRisk: false });
    expect(result.m).toBe(1);
    expect(result.label).toContain("not available");
  });

  it("applies 6% discount for high-risk flood zones", () => {
    const highRisk: FloodZoneResult = { zone: "AE", highRisk: true, moderateRisk: false };
    const result = floodZoneMultiplier(highRisk);
    expect(result.m).toBe(0.94);
    expect(result.label).toContain("high risk");
  });

  it("applies 2% discount for moderate-risk zones", () => {
    const moderate: FloodZoneResult = { zone: "X", highRisk: false, moderateRisk: true };
    const result = floodZoneMultiplier(moderate);
    expect(result.m).toBe(0.98);
    expect(result.label).toContain("moderate risk");
  });

  it("returns neutral for minimal-risk zones", () => {
    const minimal: FloodZoneResult = { zone: "C", highRisk: false, moderateRisk: false };
    const result = floodZoneMultiplier(minimal);
    expect(result.m).toBe(1.0);
    expect(result.label).toContain("minimal risk");
  });

  it("includes zone designation in label", () => {
    const result = floodZoneMultiplier({ zone: "VE", highRisk: true, moderateRisk: false });
    expect(result.label).toContain("VE");
  });
});
