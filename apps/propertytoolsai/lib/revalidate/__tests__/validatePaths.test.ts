import { describe, expect, it } from "vitest";
import { MAX_PATHS_PER_REQUEST, parseRevalidateBody, secretsMatch } from "../validatePaths";

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
    const r = parseRevalidateBody({ paths: ["/terms", "/pricing"] });
    expect(r).toEqual({ ok: true, paths: ["/terms", "/pricing"] });
  });

  it("accepts the singular path shape", () => {
    const r = parseRevalidateBody({ path: "/terms" });
    expect(r).toEqual({ ok: true, paths: ["/terms"] });
  });

  it("de-duplicates repeated paths", () => {
    const r = parseRevalidateBody({ paths: ["/terms", "/terms", "/pricing"] });
    expect(r.ok && r.paths).toEqual(["/terms", "/pricing"]);
  });

  it("rejects non-object body", () => {
    expect(parseRevalidateBody(null)).toMatchObject({ ok: false, status: 400 });
    expect(parseRevalidateBody("hi")).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects when neither path nor paths is present", () => {
    expect(parseRevalidateBody({})).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects empty paths array", () => {
    expect(parseRevalidateBody({ paths: [] })).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects path without leading slash", () => {
    expect(parseRevalidateBody({ paths: ["terms"] })).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects paths containing ..", () => {
    expect(parseRevalidateBody({ paths: ["/../etc/passwd"] })).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it("rejects path longer than 500 chars", () => {
    const long = "/" + "x".repeat(500);
    expect(parseRevalidateBody({ paths: [long] })).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects non-string path entries", () => {
    expect(parseRevalidateBody({ paths: [123] })).toMatchObject({ ok: false, status: 400 });
    expect(parseRevalidateBody({ paths: [null] })).toMatchObject({ ok: false, status: 400 });
  });

  it("413s on > MAX_PATHS_PER_REQUEST entries", () => {
    const many = Array.from({ length: MAX_PATHS_PER_REQUEST + 1 }, (_, i) => `/p${i}`);
    expect(parseRevalidateBody({ paths: many })).toMatchObject({ ok: false, status: 413 });
  });
});
