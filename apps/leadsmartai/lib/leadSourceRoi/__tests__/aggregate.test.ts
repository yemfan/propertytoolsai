import { describe, expect, it } from "vitest";

import { aggregateBySource } from "@/lib/leadSourceRoi/aggregate";
import type { LeadSourceRoiInputContact } from "@/lib/leadSourceRoi/types";

const START = "2026-01-01T00:00:00Z";
const END = "2026-04-01T00:00:00Z";

function contact(
  overrides: Partial<LeadSourceRoiInputContact> = {},
): LeadSourceRoiInputContact {
  return {
    source: "idx_homes_for_sale",
    leadStatus: "new",
    lifecycleStage: "lead",
    closingPrice: null,
    createdAt: "2026-02-15T00:00:00Z",
    closingDate: null,
    ...overrides,
  };
}

function rowFor(report: ReturnType<typeof aggregateBySource>, key: string) {
  return report.rows.find((r) => r.sourceKey === key);
}

describe("aggregateBySource — basic shape", () => {
  it("returns startDate/endDate verbatim", () => {
    const out = aggregateBySource([], START, END);
    expect(out.startDate).toBe(START);
    expect(out.endDate).toBe(END);
  });

  it("returns empty rows + zero totals for empty input", () => {
    const out = aggregateBySource([], START, END);
    expect(out.rows).toEqual([]);
    expect(out.totals).toEqual({
      leads: 0,
      qualified: 0,
      won: 0,
      conversionPct: 0,
      totalVolume: 0,
      avgDealValue: 0,
    });
  });

  it("groups contacts by bucketed source key", () => {
    const out = aggregateBySource(
      [
        contact({ source: "idx_homes_for_sale" }),
        contact({ source: "IDX_HOMES_FOR_SALE" }), // case-insensitive bucket
        contact({ source: "voice_ai_demo" }),
      ],
      START,
      END,
    );
    expect(out.rows.length).toBe(2);
    expect(rowFor(out, "idx_homes_for_sale")?.leads).toBe(2);
    expect(rowFor(out, "voice_ai_demo")?.leads).toBe(1);
  });

  it("buckets null/empty source into __unknown__", () => {
    const out = aggregateBySource(
      [
        contact({ source: null }),
        contact({ source: "" }),
        contact({ source: "  " }),
      ],
      START,
      END,
    );
    expect(rowFor(out, "__unknown__")?.leads).toBe(3);
  });
});

describe("aggregateBySource — qualified / won classification", () => {
  it("counts past_client as won regardless of lead_status", () => {
    const out = aggregateBySource(
      [
        contact({ lifecycleStage: "past_client", leadStatus: null, closingPrice: 800_000 }),
        contact({ lifecycleStage: "past_client", leadStatus: "qualified", closingPrice: 600_000 }),
      ],
      START,
      END,
    );
    expect(rowFor(out, "idx_homes_for_sale")?.won).toBe(2);
  });

  it("counts lead_status='qualified' as qualified-but-not-won", () => {
    const out = aggregateBySource(
      [contact({ leadStatus: "qualified", lifecycleStage: "lead" })],
      START,
      END,
    );
    const r = rowFor(out, "idx_homes_for_sale");
    expect(r?.qualified).toBe(1);
    expect(r?.won).toBe(0);
  });

  it("won implies qualified in the count", () => {
    const out = aggregateBySource(
      [contact({ lifecycleStage: "past_client", closingPrice: 1_000_000 })],
      START,
      END,
    );
    const r = rowFor(out, "idx_homes_for_sale");
    expect(r?.won).toBe(1);
    expect(r?.qualified).toBe(1);
  });

  it("ignores lead_status casing when classifying", () => {
    const out = aggregateBySource(
      [contact({ leadStatus: "QUALIFIED", lifecycleStage: "lead" })],
      START,
      END,
    );
    expect(rowFor(out, "idx_homes_for_sale")?.qualified).toBe(1);
  });
});

describe("aggregateBySource — volume + avg deal value", () => {
  it("sums closing_price across won rows only", () => {
    const out = aggregateBySource(
      [
        contact({ lifecycleStage: "past_client", closingPrice: 500_000 }),
        contact({ lifecycleStage: "past_client", closingPrice: 700_000 }),
        contact({ lifecycleStage: "lead", closingPrice: 999_999 }), // ignored: not won
      ],
      START,
      END,
    );
    expect(rowFor(out, "idx_homes_for_sale")?.totalVolume).toBe(1_200_000);
    expect(rowFor(out, "idx_homes_for_sale")?.avgDealValue).toBe(600_000);
  });

  it("excludes won-but-no-price rows from the avg (no inflation by zeros)", () => {
    const out = aggregateBySource(
      [
        contact({ lifecycleStage: "past_client", closingPrice: 800_000 }),
        contact({ lifecycleStage: "past_client", closingPrice: null }),
        contact({ lifecycleStage: "past_client", closingPrice: 0 }),
      ],
      START,
      END,
    );
    const r = rowFor(out, "idx_homes_for_sale");
    expect(r?.won).toBe(3); // count includes the price-less ones
    expect(r?.totalVolume).toBe(800_000); // volume only includes the priced
    expect(r?.avgDealValue).toBe(800_000); // avg only over priced
  });

  it("returns 0 volume + 0 avg + null daysToClose when no won rows", () => {
    const out = aggregateBySource([contact({ lifecycleStage: "lead" })], START, END);
    const r = rowFor(out, "idx_homes_for_sale");
    expect(r?.totalVolume).toBe(0);
    expect(r?.avgDealValue).toBe(0);
    expect(r?.avgDaysToClose).toBeNull();
  });
});

describe("aggregateBySource — conversion %", () => {
  it("computes won / leads as a percentage rounded to 2 decimals", () => {
    const out = aggregateBySource(
      [
        contact({ lifecycleStage: "past_client", closingPrice: 500_000 }),
        contact({ lifecycleStage: "lead" }),
        contact({ lifecycleStage: "lead" }),
      ],
      START,
      END,
    );
    expect(rowFor(out, "idx_homes_for_sale")?.conversionPct).toBe(33.33);
  });

  it("returns 0 conversionPct when there are no leads in a row (defensive)", () => {
    // Can't actually happen via aggregate (a row exists only if it has leads),
    // but the math should still be safe.
    const out = aggregateBySource([], START, END);
    expect(out.totals.conversionPct).toBe(0);
  });
});

describe("aggregateBySource — days to close", () => {
  it("averages whole days from createdAt to closingDate", () => {
    const out = aggregateBySource(
      [
        contact({
          lifecycleStage: "past_client",
          closingPrice: 500_000,
          createdAt: "2026-01-01T00:00:00Z",
          closingDate: "2026-02-01T00:00:00Z", // 31 days
        }),
        contact({
          lifecycleStage: "past_client",
          closingPrice: 600_000,
          createdAt: "2026-01-01T00:00:00Z",
          closingDate: "2026-04-01T00:00:00Z", // 90 days
        }),
      ],
      START,
      END,
    );
    expect(rowFor(out, "idx_homes_for_sale")?.avgDaysToClose).toBe(60.5);
  });

  it("ignores won rows without a closingDate when computing the avg", () => {
    const out = aggregateBySource(
      [
        contact({
          lifecycleStage: "past_client",
          closingPrice: 500_000,
          createdAt: "2026-01-01T00:00:00Z",
          closingDate: "2026-02-01T00:00:00Z",
        }),
        contact({
          lifecycleStage: "past_client",
          closingPrice: 600_000,
          createdAt: "2026-01-01T00:00:00Z",
          closingDate: null,
        }),
      ],
      START,
      END,
    );
    expect(rowFor(out, "idx_homes_for_sale")?.avgDaysToClose).toBe(31);
  });
});

describe("aggregateBySource — sort + totals", () => {
  it("sorts rows by totalVolume desc, then conversion, then leads", () => {
    const out = aggregateBySource(
      [
        // idx: 2 leads, 1 won @ $500K
        contact({ source: "idx_homes_for_sale", lifecycleStage: "past_client", closingPrice: 500_000 }),
        contact({ source: "idx_homes_for_sale" }),
        // voice: 1 lead, 1 won @ $1.5M  → highest volume → first
        contact({ source: "voice_ai_demo", lifecycleStage: "past_client", closingPrice: 1_500_000 }),
        // home_value: 5 leads, 0 won
        contact({ source: "home_value" }),
        contact({ source: "home_value" }),
        contact({ source: "home_value" }),
        contact({ source: "home_value" }),
        contact({ source: "home_value" }),
      ],
      START,
      END,
    );

    const order = out.rows.map((r) => r.sourceKey);
    expect(order[0]).toBe("voice_ai_demo");
    expect(order[1]).toBe("idx_homes_for_sale");
    expect(order[2]).toBe("home_value");
  });

  it("computes totals across all rows (volume-weighted avg)", () => {
    const out = aggregateBySource(
      [
        contact({ source: "idx_homes_for_sale", lifecycleStage: "past_client", closingPrice: 500_000 }),
        contact({ source: "voice_ai_demo", lifecycleStage: "past_client", closingPrice: 1_500_000 }),
        contact({ source: "home_value" }),
        contact({ source: "home_value" }),
      ],
      START,
      END,
    );
    expect(out.totals.leads).toBe(4);
    expect(out.totals.won).toBe(2);
    expect(out.totals.totalVolume).toBe(2_000_000);
    expect(out.totals.avgDealValue).toBe(1_000_000);
    expect(out.totals.conversionPct).toBe(50);
  });
});
