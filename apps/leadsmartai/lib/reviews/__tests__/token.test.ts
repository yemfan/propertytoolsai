import { describe, expect, it } from "vitest";
import {
  computeReviewExpiresAt,
  DEFAULT_REVIEW_TTL_DAYS,
  generateReviewToken,
  hashReviewToken,
  isReviewRequestUsable,
  MAX_REVIEW_TTL_DAYS,
} from "../token";

describe("generateReviewToken", () => {
  it("returns a base64url raw + matching SHA-256 hex hash", () => {
    const t = generateReviewToken();
    expect(t.rawToken).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(t.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashReviewToken(t.rawToken)).toBe(t.tokenHash);
  });

  it("never collides", () => {
    const a = generateReviewToken();
    const b = generateReviewToken();
    expect(a.rawToken).not.toBe(b.rawToken);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });
});

describe("computeReviewExpiresAt", () => {
  it("defaults to 60 days when omitted", () => {
    const out = computeReviewExpiresAt({ nowIso: "2026-01-01T00:00:00.000Z" });
    const expected = new Date(
      Date.parse("2026-01-01T00:00:00.000Z") + DEFAULT_REVIEW_TTL_DAYS * 86_400_000,
    ).toISOString();
    expect(out).toBe(expected);
  });

  it("clamps min at 7 days", () => {
    const out = computeReviewExpiresAt({
      nowIso: "2026-01-01T00:00:00.000Z",
      days: 1,
    });
    const expected = new Date(
      Date.parse("2026-01-01T00:00:00.000Z") + 7 * 86_400_000,
    ).toISOString();
    expect(out).toBe(expected);
  });

  it("clamps max at MAX_REVIEW_TTL_DAYS", () => {
    const out = computeReviewExpiresAt({
      nowIso: "2026-01-01T00:00:00.000Z",
      days: 9999,
    });
    const expected = new Date(
      Date.parse("2026-01-01T00:00:00.000Z") + MAX_REVIEW_TTL_DAYS * 86_400_000,
    ).toISOString();
    expect(out).toBe(expected);
  });
});

describe("isReviewRequestUsable", () => {
  it("rejects already-responded requests", () => {
    expect(
      isReviewRequestUsable({
        expiresAt: "2099-01-01T00:00:00Z",
        respondedAt: "2026-01-15T00:00:00Z",
        nowIso: "2026-01-20T00:00:00Z",
      }),
    ).toBe(false);
  });

  it("rejects expired requests", () => {
    expect(
      isReviewRequestUsable({
        expiresAt: "2026-01-15T00:00:00Z",
        respondedAt: null,
        nowIso: "2026-01-20T00:00:00Z",
      }),
    ).toBe(false);
  });

  it("accepts unexpired, unused requests", () => {
    expect(
      isReviewRequestUsable({
        expiresAt: "2099-01-01T00:00:00Z",
        respondedAt: null,
        nowIso: "2026-01-20T00:00:00Z",
      }),
    ).toBe(true);
  });

  it("rejects malformed timestamps rather than letting them through", () => {
    expect(
      isReviewRequestUsable({
        expiresAt: "not-a-date",
        respondedAt: null,
        nowIso: "2026-01-20T00:00:00Z",
      }),
    ).toBe(false);
  });
});
