import { describe, expect, it } from "vitest";
import { resolveWeeklyBatchLimit } from "./resolveWeeklyLimit";

describe("resolveWeeklyBatchLimit", () => {
  it("returns 0 when env unset and no query", () => {
    expect(resolveWeeklyBatchLimit(null, undefined)).toBe(0);
  });

  it("returns 0 when env is 0", () => {
    expect(resolveWeeklyBatchLimit(null, "0")).toBe(0);
  });

  it("uses env when positive", () => {
    expect(resolveWeeklyBatchLimit(null, "50")).toBe(50);
    expect(resolveWeeklyBatchLimit(null, "3")).toBe(3);
  });

  it("floors env decimals", () => {
    expect(resolveWeeklyBatchLimit(null, "10.7")).toBe(10);
  });

  it("returns 0 for invalid env", () => {
    expect(resolveWeeklyBatchLimit(null, "nan")).toBe(0);
  });

  it("query override wins when positive", () => {
    expect(resolveWeeklyBatchLimit("5", "100")).toBe(5);
  });

  it("query 0 or negative yields 0 (does not fall back to env)", () => {
    expect(resolveWeeklyBatchLimit("0", "50")).toBe(0);
    expect(resolveWeeklyBatchLimit("-1", "50")).toBe(0);
  });

  it("empty query string falls back to env", () => {
    expect(resolveWeeklyBatchLimit("", "12")).toBe(12);
  });

  it("whitespace-only query falls back to env", () => {
    expect(resolveWeeklyBatchLimit("   ", "7")).toBe(7);
  });
});
