import { describe, expect, it } from "vitest";

import {
  buildForecastSummary,
  weightForCloseDate,
  type ForecastInputRow,
} from "@/lib/performance/commissionForecast";

const NOW = "2026-04-27";

function row(overrides: Partial<ForecastInputRow> = {}): ForecastInputRow {
  return {
    id: "t1",
    transactionType: "buyer_rep",
    status: "active",
    propertyAddress: "10 Elm St",
    closingDate: null,
    grossCommission: null,
    agentNetCommission: null,
    mutualAcceptanceDate: null,
    ...overrides,
  };
}

describe("weightForCloseDate", () => {
  it("returns the missing-date discount when closingDate is null", () => {
    expect(weightForCloseDate(null, NOW)).toBe(0.3);
  });

  it("past-due → 0.40", () => {
    expect(weightForCloseDate("2026-04-20", NOW)).toBe(0.4);
    expect(weightForCloseDate("2026-01-01", NOW)).toBe(0.4);
  });

  it("0-30 days → 0.90", () => {
    expect(weightForCloseDate("2026-04-27", NOW)).toBe(0.9);
    expect(weightForCloseDate("2026-05-15", NOW)).toBe(0.9);
    expect(weightForCloseDate("2026-05-27", NOW)).toBe(0.9);
  });

  it("31-60 days → 0.75", () => {
    expect(weightForCloseDate("2026-05-28", NOW)).toBe(0.75);
    expect(weightForCloseDate("2026-06-26", NOW)).toBe(0.75);
  });

  it("61-90 days → 0.60", () => {
    expect(weightForCloseDate("2026-07-26", NOW)).toBe(0.6);
  });

  it("91-180 days → 0.40", () => {
    expect(weightForCloseDate("2026-09-15", NOW)).toBe(0.4);
    expect(weightForCloseDate("2026-10-24", NOW)).toBe(0.4);
  });

  it("180+ days → 0.25", () => {
    expect(weightForCloseDate("2027-01-01", NOW)).toBe(0.25);
  });

  it("treats unparseable dates as the missing-date discount", () => {
    expect(weightForCloseDate("not-a-date", NOW)).toBe(0.3);
  });
});

describe("buildForecastSummary — filtering", () => {
  it("excludes closed and terminated rows even if caller passed them", () => {
    const out = buildForecastSummary(
      [
        row({ id: "a", status: "active", grossCommission: 1000 }),
        row({ id: "b", status: "closed", grossCommission: 5000 }),
        row({ id: "c", status: "terminated", grossCommission: 9999 }),
        row({ id: "d", status: "pending", grossCommission: 2000 }),
      ],
      NOW,
    );
    expect(out.totalCount).toBe(2);
    expect(out.grossCommission).toBe(3000);
  });

  it("returns zeros for an empty input", () => {
    const out = buildForecastSummary([], NOW);
    expect(out).toMatchObject({
      totalCount: 0,
      grossCommission: 0,
      netCommission: 0,
      weightedGross: 0,
      weightedNet: 0,
      pastDueCount: 0,
      byMonth: [],
    });
  });
});

describe("buildForecastSummary — totals + weighting", () => {
  it("sums gross and net unweighted across all in-flight deals", () => {
    const out = buildForecastSummary(
      [
        row({ id: "a", grossCommission: 1000, agentNetCommission: 700, closingDate: "2026-05-15" }),
        row({ id: "b", grossCommission: 2000, agentNetCommission: 1400, closingDate: "2026-06-15" }),
      ],
      NOW,
    );
    expect(out.grossCommission).toBe(3000);
    expect(out.netCommission).toBe(2100);
  });

  it("applies per-row close-date weight to weightedGross/weightedNet", () => {
    const out = buildForecastSummary(
      [
        // 0-30 days → 0.9
        row({ id: "a", grossCommission: 1000, agentNetCommission: 700, closingDate: "2026-05-15" }),
        // 91-180 days → 0.4
        row({ id: "b", grossCommission: 2000, agentNetCommission: 1400, closingDate: "2026-09-15" }),
      ],
      NOW,
    );
    // 1000*0.9 + 2000*0.4 = 900 + 800 = 1700
    expect(out.weightedGross).toBe(1700);
    // 700*0.9 + 1400*0.4 = 630 + 560 = 1190
    expect(out.weightedNet).toBe(1190);
  });

  it("treats null commission as zero (missing data shouldn't blow up)", () => {
    const out = buildForecastSummary(
      [
        row({ id: "a", grossCommission: null, agentNetCommission: null, closingDate: "2026-05-15" }),
        row({ id: "b", grossCommission: 1000, agentNetCommission: 700, closingDate: "2026-05-15" }),
      ],
      NOW,
    );
    expect(out.grossCommission).toBe(1000);
    expect(out.weightedGross).toBe(900); // 0 + 1000*0.9
  });
});

describe("buildForecastSummary — past-due tracking", () => {
  it("counts rows whose closing_date is before now", () => {
    const out = buildForecastSummary(
      [
        row({ id: "a", closingDate: "2026-04-26" }), // yesterday
        row({ id: "b", closingDate: "2026-01-15" }), // months ago
        row({ id: "c", closingDate: "2026-05-15" }), // upcoming
        row({ id: "d", closingDate: null }), // no anchor → not past-due
      ],
      NOW,
    );
    expect(out.pastDueCount).toBe(2);
  });
});

describe("buildForecastSummary — byMonth bucketing", () => {
  it("buckets by closing_date YYYY-MM with chronological sort", () => {
    const out = buildForecastSummary(
      [
        row({ id: "a", grossCommission: 1000, closingDate: "2026-06-15" }),
        row({ id: "b", grossCommission: 500, closingDate: "2026-06-22" }),
        row({ id: "c", grossCommission: 2000, closingDate: "2026-05-10" }),
      ],
      NOW,
    );
    expect(out.byMonth.map((b) => b.month)).toEqual(["2026-05", "2026-06"]);
    const may = out.byMonth.find((b) => b.month === "2026-05")!;
    const jun = out.byMonth.find((b) => b.month === "2026-06")!;
    expect(may.count).toBe(1);
    expect(may.grossCommission).toBe(2000);
    expect(jun.count).toBe(2);
    expect(jun.grossCommission).toBe(1500);
  });

  it("collects rows with no closing_date into a 'no-date' bucket sorted last", () => {
    const out = buildForecastSummary(
      [
        row({ id: "a", grossCommission: 1000, closingDate: "2026-05-15" }),
        row({ id: "b", grossCommission: 500, closingDate: null }),
        row({ id: "c", grossCommission: 2000, closingDate: "2026-06-22" }),
      ],
      NOW,
    );
    expect(out.byMonth.map((b) => b.month)).toEqual(["2026-05", "2026-06", "no-date"]);
    const noDate = out.byMonth[2];
    expect(noDate.count).toBe(1);
    expect(noDate.grossCommission).toBe(500);
    expect(noDate.label).toBe("No close date");
  });

  it("populates weightedGross/weightedNet per bucket", () => {
    const out = buildForecastSummary(
      [
        // both 0-30 days → 0.9 weight
        row({ id: "a", grossCommission: 1000, agentNetCommission: 700, closingDate: "2026-05-15" }),
        row({ id: "b", grossCommission: 500, agentNetCommission: 350, closingDate: "2026-05-20" }),
      ],
      NOW,
    );
    const may = out.byMonth.find((b) => b.month === "2026-05")!;
    expect(may.weightedGross).toBe(1350); // 1500 * 0.9
    expect(may.weightedNet).toBe(945); // 1050 * 0.9
  });
});

describe("buildForecastSummary — byType breakdown", () => {
  it("groups counts and totals by transaction_type", () => {
    const out = buildForecastSummary(
      [
        row({ id: "a", transactionType: "buyer_rep", grossCommission: 1000, agentNetCommission: 700, closingDate: "2026-05-15" }),
        row({ id: "b", transactionType: "buyer_rep", grossCommission: 500, agentNetCommission: 350, closingDate: "2026-05-20" }),
        row({ id: "c", transactionType: "listing_rep", grossCommission: 3000, agentNetCommission: 2100, closingDate: "2026-05-15" }),
        row({ id: "d", transactionType: "dual", grossCommission: 4000, agentNetCommission: 2800, closingDate: "2026-05-15" }),
      ],
      NOW,
    );
    expect(out.byType.buyer_rep.count).toBe(2);
    expect(out.byType.buyer_rep.gross).toBe(1500);
    expect(out.byType.listing_rep.count).toBe(1);
    expect(out.byType.listing_rep.gross).toBe(3000);
    expect(out.byType.dual.count).toBe(1);
    expect(out.byType.dual.gross).toBe(4000);
  });

  it("zero rows for an unrepresented type", () => {
    const out = buildForecastSummary(
      [row({ id: "a", transactionType: "buyer_rep", grossCommission: 1000, closingDate: "2026-05-15" })],
      NOW,
    );
    expect(out.byType.listing_rep.count).toBe(0);
    expect(out.byType.listing_rep.gross).toBe(0);
    expect(out.byType.dual.count).toBe(0);
  });
});
