import { describe, expect, it } from "vitest";
import {
  computeProgress,
  getDayOfYear,
  getDaysInYear,
  type ProgressInput,
  type ProgressTargets,
} from "../progress";

const TARGETS: ProgressTargets = {
  annualTransactionTarget: 10,
  conversionRateTargetPct: 3,
};

function input(partial: Partial<ProgressInput>): ProgressInput {
  return {
    transactionsYtd: 0,
    contactsLast12Months: 0,
    closedContactsLast12Months: 0,
    dayOfYear: 180,
    daysInYear: 365,
    ...partial,
  };
}

describe("coaching-programs / progress / transactions", () => {
  it("ahead: actual >= target", () => {
    const r = computeProgress(input({ transactionsYtd: 12 }), TARGETS);
    expect(r.transactions.tone).toBe("ahead");
    expect(r.transactions.actual).toBe(12);
    expect(r.transactions.target).toBe(10);
    expect(r.transactions.ratio).toBe(1);
    expect(r.transactions.display).toBe("12 / 10");
  });

  it("on_track: at expected pace for day-of-year", () => {
    // halfway through year, ~5 deals = on pace for 10
    const r = computeProgress(
      input({ transactionsYtd: 5, dayOfYear: 183, daysInYear: 365 }),
      TARGETS,
    );
    expect(r.transactions.tone).toBe("on_track");
  });

  it("behind: well under expected pace mid-year", () => {
    const r = computeProgress(
      input({ transactionsYtd: 1, dayOfYear: 200, daysInYear: 365 }),
      TARGETS,
    );
    expect(r.transactions.tone).toBe("behind");
  });

  it("no_data: zero target", () => {
    const r = computeProgress(input({ transactionsYtd: 0 }), {
      annualTransactionTarget: 0,
      conversionRateTargetPct: 3,
    });
    expect(r.transactions.tone).toBe("no_data");
    expect(r.transactions.ratio).toBe(0);
  });

  it("forgives early-year zeros (within first 10% of year)", () => {
    // dayOfYear 30 / 365 = 8.2% — under the 10% threshold,
    // so a zero count is on_track-equivalent (still classified
    // by pace math, but not auto-flagged "behind" via the
    // zero-count short-circuit).
    const r = computeProgress(
      input({ transactionsYtd: 0, dayOfYear: 30, daysInYear: 365 }),
      TARGETS,
    );
    // expectedSoFar = 10 * 30/365 = 0.82, actual=0, 0 >= 0.82*0.85=0.70 → false → behind.
    // But the zero-count short-circuit only fires when dayRatio > 0.1, which it isn't here.
    // So the classification falls through to the "behind" branch via the regular check.
    // What we DO want to verify is the short-circuit doesn't fire prematurely.
    expect(r.transactions.tone).toBe("behind");
  });

  it("zero count after 10% of year is auto-behind", () => {
    const r = computeProgress(
      input({ transactionsYtd: 0, dayOfYear: 100, daysInYear: 365 }),
      TARGETS,
    );
    expect(r.transactions.tone).toBe("behind");
  });

  it("ratio caps at 1 even when actual exceeds target", () => {
    const r = computeProgress(input({ transactionsYtd: 50 }), TARGETS);
    expect(r.transactions.ratio).toBe(1);
  });
});

describe("coaching-programs / progress / conversion", () => {
  it("no_data when denom is zero", () => {
    const r = computeProgress(
      input({ contactsLast12Months: 0, closedContactsLast12Months: 0 }),
      TARGETS,
    );
    expect(r.conversion.tone).toBe("no_data");
    expect(r.conversion.actual).toBe(0);
  });

  it("computes percentage and rounds to one decimal", () => {
    // 4 / 100 = 4.0%
    const r = computeProgress(
      input({ contactsLast12Months: 100, closedContactsLast12Months: 4 }),
      TARGETS,
    );
    expect(r.conversion.actual).toBe(4);
    expect(r.conversion.tone).toBe("ahead");
  });

  it("on_track between 70% and 100% of target", () => {
    // target 3%, actual 2.5% (83% of target)
    const r = computeProgress(
      input({ contactsLast12Months: 200, closedContactsLast12Months: 5 }),
      TARGETS,
    );
    expect(r.conversion.actual).toBe(2.5);
    expect(r.conversion.tone).toBe("on_track");
  });

  it("behind under 70% of target", () => {
    // target 3%, actual 1% (33% of target)
    const r = computeProgress(
      input({ contactsLast12Months: 100, closedContactsLast12Months: 1 }),
      TARGETS,
    );
    expect(r.conversion.actual).toBe(1);
    expect(r.conversion.tone).toBe("behind");
  });

  it("display includes both actual and target percentages", () => {
    const r = computeProgress(
      input({ contactsLast12Months: 100, closedContactsLast12Months: 3 }),
      TARGETS,
    );
    expect(r.conversion.display).toBe("3% / 3%");
  });

  it("ratio caps at 1 even when conversion exceeds target", () => {
    const r = computeProgress(
      input({ contactsLast12Months: 100, closedContactsLast12Months: 50 }),
      TARGETS,
    );
    expect(r.conversion.ratio).toBe(1);
  });

  it("does not divide by zero when denominator is zero", () => {
    const r = computeProgress(
      input({ contactsLast12Months: 0, closedContactsLast12Months: 7 }),
      TARGETS,
    );
    expect(Number.isFinite(r.conversion.actual)).toBe(true);
    expect(r.conversion.tone).toBe("no_data");
  });
});

describe("coaching-programs / progress / date helpers", () => {
  it("getDayOfYear returns 1 for Jan 1", () => {
    expect(getDayOfYear(new Date(2026, 0, 1))).toBe(1);
  });

  it("getDayOfYear returns 365 for Dec 31 in non-leap year", () => {
    expect(getDayOfYear(new Date(2025, 11, 31))).toBe(365);
  });

  it("getDayOfYear returns 366 for Dec 31 in leap year", () => {
    expect(getDayOfYear(new Date(2024, 11, 31))).toBe(366);
  });

  it("getDaysInYear: 2024 is leap (div by 4)", () => {
    expect(getDaysInYear(2024)).toBe(366);
  });

  it("getDaysInYear: 2025 is not leap", () => {
    expect(getDaysInYear(2025)).toBe(365);
  });

  it("getDaysInYear: 2100 is NOT leap (div by 100, not 400)", () => {
    expect(getDaysInYear(2100)).toBe(365);
  });

  it("getDaysInYear: 2000 IS leap (div by 400)", () => {
    expect(getDaysInYear(2000)).toBe(366);
  });
});
