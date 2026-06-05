import { describe, it, expect } from "vitest";
import { pctChange } from "./metrics-format";

describe("pctChange", () => {
  it("labels brand-new activity from a zero baseline", () => {
    expect(pctChange(5, 0)).toBe("new");
    expect(pctChange(1, 0)).toBe("new");
  });

  it("labels a flat zero-to-zero (or negative) as flat", () => {
    expect(pctChange(0, 0)).toBe("flat");
    expect(pctChange(-3, 0)).toBe("flat");
  });

  it("formats increases with a + sign and whole percent", () => {
    expect(pctChange(120, 100)).toBe("+20%");
    expect(pctChange(150, 100)).toBe("+50%");
    expect(pctChange(200, 100)).toBe("+100%");
  });

  it("formats decreases with a - sign", () => {
    expect(pctChange(80, 100)).toBe("-20%");
    expect(pctChange(0, 100)).toBe("-100%");
  });

  it("reports 0% for no change", () => {
    expect(pctChange(100, 100)).toBe("+0%");
  });

  it("rounds to the nearest whole percent", () => {
    expect(pctChange(133, 100)).toBe("+33%");
    expect(pctChange(1335, 1000)).toBe("+34%"); // 33.5 → 34 (toFixed rounds half up)
    expect(pctChange(666, 1000)).toBe("-33%");   // -33.4 → -33
  });

  it("handles fractional baselines", () => {
    expect(pctChange(1.5, 1)).toBe("+50%");
  });
});
