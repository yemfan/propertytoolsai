import { describe, expect, it } from "vitest";
import { renewalReminderWindow } from "../renewalWindow";

describe("renewalReminderWindow", () => {
  it("returns a 5-day window centered on 30 days from now", () => {
    const fixedNow = new Date("2026-05-15T12:00:00.000Z");
    const { windowStart, windowEnd } = renewalReminderWindow(fixedNow);

    const startMs = new Date(windowStart).getTime();
    const endMs = new Date(windowEnd).getTime();
    const nowMs = fixedNow.getTime();
    const oneDay = 86_400_000;

    expect((startMs - nowMs) / oneDay).toBeCloseTo(27.5, 1);
    expect((endMs - nowMs) / oneDay).toBeCloseTo(32.5, 1);
    expect((endMs - startMs) / oneDay).toBeCloseTo(5, 1);
  });

  it("a sub renewing exactly 30 days out falls inside the window", () => {
    const fixedNow = new Date("2026-05-15T12:00:00.000Z");
    const { windowStart, windowEnd } = renewalReminderWindow(fixedNow);
    const renewal = new Date(fixedNow.getTime() + 30 * 86_400_000).toISOString();
    expect(renewal >= windowStart && renewal < windowEnd).toBe(true);
  });

  it("a sub renewing 27 days out (too soon) falls OUTSIDE the window", () => {
    const fixedNow = new Date("2026-05-15T12:00:00.000Z");
    const { windowStart } = renewalReminderWindow(fixedNow);
    const renewal = new Date(fixedNow.getTime() + 27 * 86_400_000).toISOString();
    expect(renewal < windowStart).toBe(true);
  });

  it("a sub renewing 33 days out (too far) falls OUTSIDE the window", () => {
    const fixedNow = new Date("2026-05-15T12:00:00.000Z");
    const { windowEnd } = renewalReminderWindow(fixedNow);
    const renewal = new Date(fixedNow.getTime() + 33 * 86_400_000).toISOString();
    expect(renewal >= windowEnd).toBe(true);
  });

  it("default `now` argument uses the current wall clock", () => {
    const before = Date.now();
    const { windowStart } = renewalReminderWindow();
    const startMs = new Date(windowStart).getTime();
    expect(startMs - before).toBeGreaterThan(27 * 86_400_000);
  });
});
