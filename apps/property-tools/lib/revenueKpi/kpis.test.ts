import { describe, expect, it } from "vitest";
import { bucketDailyRevenue, buildKpiSummary, pctChange } from "./kpis";

describe("pctChange", () => {
  it("computes percent change", () => {
    expect(pctChange(110, 100)).toBe(10);
    expect(pctChange(90, 100)).toBe(-10);
  });

  it("returns null when prior is zero", () => {
    expect(pctChange(10, 0)).toBeNull();
  });
});

describe("buildKpiSummary", () => {
  it("builds summary with conversion", () => {
    const k = buildKpiSummary({
      windowDays: 30,
      revenueCents: 10000,
      revenueCentsPrior: 8000,
      transactionCount: 2,
      funnelSessions: 5,
      leadEvents: 3,
      pageViewEvents: 100,
      purchaseEvents: 5,
    });
    expect(k.revenueMomPct).toBe(25);
    expect(k.avgDealCents).toBe(5000);
    expect(k.funnelConversionPct).toBe(5);
  });
});

describe("bucketDailyRevenue", () => {
  it("fills days in range", () => {
    const start = new Date("2025-01-01T00:00:00.000Z");
    const end = new Date("2025-01-03T00:00:00.000Z");
    const rows = [
      { occurred_at: "2025-01-02T12:00:00.000Z", amount_cents: 1000 },
      { occurred_at: "2025-01-02T15:00:00.000Z", amount_cents: 500 },
    ];
    const b = bucketDailyRevenue(rows, start, end);
    expect(b.find((x) => x.day === "2025-01-02")?.revenueCents).toBe(1500);
    expect(b.find((x) => x.day === "2025-01-01")?.revenueCents).toBe(0);
  });
});
