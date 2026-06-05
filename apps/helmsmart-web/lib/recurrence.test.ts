import { describe, it, expect } from "vitest";
import { computeNextRun, describeRecurrence } from "./recurrence";

// Reference base: Wednesday 2026-06-10T12:00:00Z (UTC day-of-week = 3)
const WED_NOON = new Date("2026-06-10T12:00:00.000Z");

describe("computeNextRun — weekly", () => {
  it("advances to the next occurrence of the target weekday", () => {
    // From Wed noon, next Friday (5) at 09:00
    const next = computeNextRun("weekly", 5, 9, WED_NOON);
    const d = new Date(next);
    expect(d.getUTCDay()).toBe(5); // Friday
    expect(d.getUTCHours()).toBe(9);
    expect(d.toISOString()).toBe("2026-06-12T09:00:00.000Z");
  });

  it("when target weekday is today but the hour already passed, pushes a full week", () => {
    // Wed (3) at 09:00 — but base is Wed 12:00, so 09:00 already passed → next Wed
    const next = computeNextRun("weekly", 3, 9, WED_NOON);
    const d = new Date(next);
    expect(d.getUTCDay()).toBe(3);
    expect(d.toISOString()).toBe("2026-06-17T09:00:00.000Z");
  });

  it("when target weekday is today and the hour is still ahead, stays today", () => {
    // Wed (3) at 18:00 — base is Wed 12:00, so 18:00 is still ahead today
    const next = computeNextRun("weekly", 3, 18, WED_NOON);
    const d = new Date(next);
    expect(d.toISOString()).toBe("2026-06-10T18:00:00.000Z");
  });

  it("handles wrap-around to earlier weekday next week", () => {
    // From Wed, target Monday (1) → next Monday
    const next = computeNextRun("weekly", 1, 9, WED_NOON);
    const d = new Date(next);
    expect(d.getUTCDay()).toBe(1);
    expect(d.toISOString()).toBe("2026-06-15T09:00:00.000Z");
  });

  it("clamps out-of-range weekday values", () => {
    const next = computeNextRun("weekly", 99, 9, WED_NOON);
    const d = new Date(next);
    expect(d.getUTCDay()).toBe(6); // clamped to Saturday
  });

  it("always returns a time strictly after `from`", () => {
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const next = new Date(computeNextRun("weekly", day, hour, WED_NOON));
        expect(next.getTime()).toBeGreaterThan(WED_NOON.getTime());
      }
    }
  });
});

describe("computeNextRun — monthly", () => {
  it("targets the given day-of-month later this month", () => {
    // From June 10, target the 20th
    const next = computeNextRun("monthly", 20, 9, WED_NOON);
    const d = new Date(next);
    expect(d.getUTCDate()).toBe(20);
    expect(d.getUTCMonth()).toBe(5); // June (0-indexed)
    expect(d.toISOString()).toBe("2026-06-20T09:00:00.000Z");
  });

  it("rolls to next month when the target day has already passed", () => {
    // From June 10, target the 5th → already passed → July 5
    const next = computeNextRun("monthly", 5, 9, WED_NOON);
    const d = new Date(next);
    expect(d.getUTCDate()).toBe(5);
    expect(d.getUTCMonth()).toBe(6); // July
  });

  it("rolls to next month when target day is today but hour passed", () => {
    // From June 10 noon, target the 10th at 09:00 → passed → July 10
    const next = computeNextRun("monthly", 10, 9, WED_NOON);
    const d = new Date(next);
    expect(d.getUTCDate()).toBe(10);
    expect(d.getUTCMonth()).toBe(6); // July
  });

  it("stays this month when target day is today and hour ahead", () => {
    const next = computeNextRun("monthly", 10, 18, WED_NOON);
    const d = new Date(next);
    expect(d.toISOString()).toBe("2026-06-10T18:00:00.000Z");
  });

  it("clamps day-of-month to 1..28", () => {
    const high = new Date(computeNextRun("monthly", 99, 9, WED_NOON));
    expect(high.getUTCDate()).toBe(28);
    const low = new Date(computeNextRun("monthly", 0, 9, WED_NOON));
    expect(low.getUTCDate()).toBe(1);
  });

  it("handles year boundary (December → January)", () => {
    const dec20 = new Date("2026-12-20T12:00:00.000Z");
    const next = new Date(computeNextRun("monthly", 5, 9, dec20));
    expect(next.getUTCDate()).toBe(5);
    expect(next.getUTCMonth()).toBe(0); // January
    expect(next.getUTCFullYear()).toBe(2027);
  });
});

describe("describeRecurrence", () => {
  it("describes weekly schedules", () => {
    expect(describeRecurrence("weekly", 1, 9)).toBe("Every Monday at 9:00 AM UTC");
    expect(describeRecurrence("weekly", 5, 14)).toBe("Every Friday at 2:00 PM UTC");
    expect(describeRecurrence("weekly", 0, 0)).toBe("Every Sunday at 12:00 AM UTC");
  });

  it("describes monthly schedules with ordinal suffixes", () => {
    expect(describeRecurrence("monthly", 1, 9)).toBe("Monthly on the 1st at 9:00 AM UTC");
    expect(describeRecurrence("monthly", 2, 9)).toBe("Monthly on the 2nd at 9:00 AM UTC");
    expect(describeRecurrence("monthly", 3, 9)).toBe("Monthly on the 3rd at 9:00 AM UTC");
    expect(describeRecurrence("monthly", 4, 9)).toBe("Monthly on the 4th at 9:00 AM UTC");
    expect(describeRecurrence("monthly", 15, 12)).toBe("Monthly on the 15th at 12:00 PM UTC");
  });
});
