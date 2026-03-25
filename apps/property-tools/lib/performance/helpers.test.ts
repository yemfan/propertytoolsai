import { describe, expect, it } from "vitest";
import { avg, isClosedLeadStatus, minutesBetween, rowRevenue } from "./helpers";

describe("performance helpers", () => {
  it("avg", () => {
    expect(avg([])).toBe(0);
    expect(avg([2, 4])).toBe(3);
  });

  it("minutesBetween", () => {
    expect(minutesBetween(null, "2020-01-01")).toBeNull();
    const a = "2025-01-01T12:00:00.000Z";
    const b = "2025-01-01T12:30:00.000Z";
    expect(minutesBetween(a, b)).toBe(30);
    expect(minutesBetween(b, a)).toBeNull();
  });

  it("rowRevenue", () => {
    expect(rowRevenue({})).toBe(0);
    expect(rowRevenue({ gross_commission: 1000, recurring_revenue: 250 })).toBe(1250);
  });

  it("isClosedLeadStatus", () => {
    expect(isClosedLeadStatus({ lead_status: "Closed" })).toBe(true);
    expect(isClosedLeadStatus({ status: "converted" })).toBe(true);
    expect(isClosedLeadStatus({ status: "new" })).toBe(false);
  });
});
