import { describe, expect, it } from "vitest";
import { expandOccurrences } from "../expandOccurrences";

describe("expandOccurrences — weekly", () => {
  it("generates N consecutive weekly occurrences on a given weekday", () => {
    // 2026-05-09 is a Saturday
    const out = expandOccurrences({
      kind: "weekly",
      anchorDate: "2026-05-09",
      weekdays: [6], // Saturday
      weeks: 4,
      startTime: "13:00",
      endTime: "16:00",
    });
    expect(out).toHaveLength(4);
    // Each date should be exactly 7 days apart
    const datePart = (iso: string) => iso.slice(0, 10);
    expect(datePart(out[0].startAt)).toBe("2026-05-09");
    expect(datePart(out[1].startAt)).toBe("2026-05-16");
    expect(datePart(out[2].startAt)).toBe("2026-05-23");
    expect(datePart(out[3].startAt)).toBe("2026-05-30");
  });

  it("walks forward to find the first matching weekday if anchor is not that day", () => {
    // 2026-05-04 is a Monday; ask for Saturday
    const out = expandOccurrences({
      kind: "weekly",
      anchorDate: "2026-05-04",
      weekdays: [6],
      weeks: 2,
      startTime: "13:00",
      endTime: "16:00",
    });
    expect(out.map((o) => o.startAt.slice(0, 10))).toEqual(["2026-05-09", "2026-05-16"]);
  });

  it("supports multiple weekdays in one week", () => {
    const out = expandOccurrences({
      kind: "weekly",
      anchorDate: "2026-05-09", // Sat
      weekdays: [6, 0], // Sat + Sun
      weeks: 2,
      startTime: "13:00",
      endTime: "16:00",
    });
    expect(out).toHaveLength(4);
    expect(out.map((o) => o.startAt.slice(0, 10))).toEqual([
      "2026-05-09",
      "2026-05-10",
      "2026-05-16",
      "2026-05-17",
    ]);
  });

  it("returns empty for weeks=0 or empty weekdays", () => {
    expect(
      expandOccurrences({
        kind: "weekly",
        anchorDate: "2026-05-09",
        weekdays: [],
        weeks: 4,
        startTime: "13:00",
        endTime: "16:00",
      }),
    ).toEqual([]);
    expect(
      expandOccurrences({
        kind: "weekly",
        anchorDate: "2026-05-09",
        weekdays: [6],
        weeks: 0,
        startTime: "13:00",
        endTime: "16:00",
      }),
    ).toEqual([]);
  });

  it("caps at 26 occurrences for safety", () => {
    const out = expandOccurrences({
      kind: "weekly",
      anchorDate: "2026-01-03", // Sat
      weekdays: [0, 6], // Sat + Sun = 2/wk
      weeks: 20, // 40 total, over cap
      startTime: "13:00",
      endTime: "16:00",
    });
    expect(out.length).toBe(26);
  });

  it("builds start/end ISO with the right time window", () => {
    const out = expandOccurrences({
      kind: "weekly",
      anchorDate: "2026-05-09",
      weekdays: [6],
      weeks: 1,
      startTime: "13:00",
      endTime: "16:30",
    });
    const o = out[0];
    expect(new Date(o.startAt).getHours()).toBe(13);
    expect(new Date(o.startAt).getMinutes()).toBe(0);
    expect(new Date(o.endAt).getHours()).toBe(16);
    expect(new Date(o.endAt).getMinutes()).toBe(30);
  });

  it("drops occurrences where end <= start", () => {
    const out = expandOccurrences({
      kind: "weekly",
      anchorDate: "2026-05-09",
      weekdays: [6],
      weeks: 2,
      startTime: "16:00",
      endTime: "13:00",
    });
    expect(out).toEqual([]);
  });
});

describe("expandOccurrences — dates", () => {
  it("pairs each date with the shared time window", () => {
    const out = expandOccurrences({
      kind: "dates",
      dates: ["2026-05-09", "2026-05-16", "2026-05-30"],
      startTime: "14:00",
      endTime: "17:00",
    });
    expect(out).toHaveLength(3);
    expect(out[0].startAt.slice(0, 10)).toBe("2026-05-09");
    expect(out[2].startAt.slice(0, 10)).toBe("2026-05-30");
  });

  it("drops malformed YMD strings", () => {
    const out = expandOccurrences({
      kind: "dates",
      dates: ["2026-05-09", "not-a-date", "2026-13-40"],
      startTime: "14:00",
      endTime: "17:00",
    });
    expect(out).toHaveLength(1);
  });
});
