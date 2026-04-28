import { describe, expect, it } from "vitest";
import {
  computeWatchPct,
  formatDuration,
  isCountableView,
} from "../analytics";

describe("computeWatchPct", () => {
  it("computes the rounded percentage", () => {
    expect(computeWatchPct(60, 30)).toBe(50);
    expect(computeWatchPct(60, 15)).toBe(25);
    expect(computeWatchPct(60, 60)).toBe(100);
  });

  it("clamps over 100 (player overran reported duration)", () => {
    expect(computeWatchPct(60, 90)).toBe(100);
  });

  it("clamps negative watchedSec to 0", () => {
    expect(computeWatchPct(60, -5)).toBe(0);
  });

  it("returns 0 on zero or negative duration (avoids divide-by-zero)", () => {
    expect(computeWatchPct(0, 10)).toBe(0);
    expect(computeWatchPct(-60, 10)).toBe(0);
  });

  it("returns 0 on non-finite inputs", () => {
    expect(computeWatchPct(Infinity, 10)).toBe(0);
    expect(computeWatchPct(60, NaN)).toBe(0);
  });

  it("rounds to nearest integer", () => {
    // 60s × 33% = 19.8 watched → rounds to 33%
    expect(computeWatchPct(60, 19.8)).toBe(33);
    expect(computeWatchPct(60, 20.4)).toBe(34);
  });
});

describe("isCountableView", () => {
  it("counts when watched_seconds ≥ 3 (default threshold)", () => {
    expect(isCountableView({ watchPct: 0, watchedSeconds: 3 })).toBe(true);
    expect(isCountableView({ watchPct: 1, watchedSeconds: 5 })).toBe(true);
  });

  it("counts when watch_pct ≥ 25 even on short watches", () => {
    // 6s video, watched 2s = 33%. Sub-3s threshold, but pct triggers.
    expect(isCountableView({ watchPct: 33, watchedSeconds: 2 })).toBe(true);
  });

  it("does NOT count quick bounces (< 3s, < 25%)", () => {
    expect(isCountableView({ watchPct: 5, watchedSeconds: 1 })).toBe(false);
    expect(isCountableView({ watchPct: 0, watchedSeconds: 0 })).toBe(false);
  });

  it("respects custom thresholds", () => {
    expect(
      isCountableView({
        watchPct: 10,
        watchedSeconds: 5,
        minSeconds: 10,
        minPct: 50,
      }),
    ).toBe(false);
    expect(
      isCountableView({
        watchPct: 60,
        watchedSeconds: 5,
        minSeconds: 10,
        minPct: 50,
      }),
    ).toBe(true);
  });
});

describe("formatDuration", () => {
  it("formats minutes:seconds with zero-pad", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(5)).toBe("0:05");
    expect(formatDuration(42)).toBe("0:42");
    expect(formatDuration(60)).toBe("1:00");
    expect(formatDuration(125)).toBe("2:05");
  });

  it("returns 0:00 for negative or non-finite input", () => {
    expect(formatDuration(-1)).toBe("0:00");
    expect(formatDuration(NaN)).toBe("0:00");
  });

  it("rounds fractional seconds", () => {
    expect(formatDuration(42.4)).toBe("0:42");
    expect(formatDuration(42.6)).toBe("0:43");
  });
});
