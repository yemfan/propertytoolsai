import { describe, expect, it } from "vitest";
import {
  MAX_PATHS_PER_REQUEST,
  parseRevalidateBody,
  RevalidateValidationError,
  secretsMatch,
} from "../validatePaths";

describe("secretsMatch", () => {
  it("matches identical secrets", () => {
    expect(secretsMatch("abc123", "abc123")).toBe(true);
  });

  it("rejects mismatched secrets", () => {
    expect(secretsMatch("abc123", "abc124")).toBe(false);
  });

  it("rejects when provided is not a string", () => {
    expect(secretsMatch(undefined, "abc")).toBe(false);
    expect(secretsMatch(null, "abc")).toBe(false);
    expect(secretsMatch(123, "abc")).toBe(false);
  });

  it("rejects when expected is missing", () => {
    expect(secretsMatch("abc", undefined)).toBe(false);
    expect(secretsMatch("abc", "")).toBe(false);
  });

  it("rejects when lengths differ (including short prefixes of the real secret)", () => {
    expect(secretsMatch("abc", "abc123")).toBe(false);
  });
});

describe("parseRevalidateBody", () => {
  it("accepts the plural paths shape", () => {
    expect(parseRevalidateBody({ paths: ["/terms", "/pricing"] })).toEqual([
      "/terms",
      "/pricing",
    ]);
  });

  it("accepts the singular path shape", () => {
    expect(parseRevalidateBody({ path: "/terms" })).toEqual(["/terms"]);
  });

  it("de-duplicates repeated paths", () => {
    expect(parseRevalidateBody({ paths: ["/terms", "/terms", "/pricing"] })).toEqual([
      "/terms",
      "/pricing",
    ]);
  });

  function expectValidationError(fn: () => unknown, status: 400 | 401 | 413) {
    try {
      fn();
      throw new Error("expected RevalidateValidationError, none thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(RevalidateValidationError);
      expect((err as RevalidateValidationError).status).toBe(status);
    }
  }

  it("rejects non-object body with 400", () => {
    expectValidationError(() => parseRevalidateBody(null), 400);
    expectValidationError(() => parseRevalidateBody("hi"), 400);
  });

  it("rejects when neither path nor paths is present (400)", () => {
    expectValidationError(() => parseRevalidateBody({}), 400);
  });

  it("rejects empty paths array (400)", () => {
    expectValidationError(() => parseRevalidateBody({ paths: [] }), 400);
  });

  it("rejects path without leading slash (400)", () => {
    expectValidationError(() => parseRevalidateBody({ paths: ["terms"] }), 400);
  });

  it("rejects paths containing .. (400)", () => {
    expectValidationError(() => parseRevalidateBody({ paths: ["/../etc/passwd"] }), 400);
  });

  it("rejects path longer than 500 chars (400)", () => {
    const long = "/" + "x".repeat(500);
    expectValidationError(() => parseRevalidateBody({ paths: [long] }), 400);
  });

  it("rejects non-string path entries (400)", () => {
    expectValidationError(() => parseRevalidateBody({ paths: [123] }), 400);
    expectValidationError(() => parseRevalidateBody({ paths: [null] }), 400);
  });

  it("413s on > MAX_PATHS_PER_REQUEST entries", () => {
    const many = Array.from({ length: MAX_PATHS_PER_REQUEST + 1 }, (_, i) => `/p${i}`);
    expectValidationError(() => parseRevalidateBody({ paths: many }), 413);
  });
});
