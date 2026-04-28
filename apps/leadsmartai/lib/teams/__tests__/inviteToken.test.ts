import { describe, expect, it } from "vitest";
import {
  computeInviteExpiresAt,
  DEFAULT_INVITE_TTL_DAYS,
  generateInviteToken,
  hashInviteToken,
  isInviteUsable,
  MAX_INVITE_TTL_DAYS,
} from "../inviteToken";

describe("generateInviteToken", () => {
  it("returns a raw token + matching SHA-256 hash", () => {
    const t = generateInviteToken();
    expect(t.rawToken).toMatch(/^[A-Za-z0-9_-]+$/); // base64url alphabet
    expect(t.tokenHash).toMatch(/^[a-f0-9]{64}$/); // hex sha256
    expect(hashInviteToken(t.rawToken)).toBe(t.tokenHash);
  });

  it("never collides across calls", () => {
    const a = generateInviteToken();
    const b = generateInviteToken();
    expect(a.rawToken).not.toBe(b.rawToken);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });
});

describe("hashInviteToken", () => {
  it("is deterministic for the same input", () => {
    expect(hashInviteToken("abc")).toBe(hashInviteToken("abc"));
  });

  it("differs even for one-character input changes", () => {
    expect(hashInviteToken("abc")).not.toBe(hashInviteToken("abd"));
  });
});

describe("computeInviteExpiresAt", () => {
  it("defaults to DEFAULT_INVITE_TTL_DAYS when days is omitted", () => {
    const out = computeInviteExpiresAt({ nowIso: "2026-01-01T00:00:00.000Z" });
    const expected = new Date(
      Date.parse("2026-01-01T00:00:00.000Z") + DEFAULT_INVITE_TTL_DAYS * 86_400_000,
    ).toISOString();
    expect(out).toBe(expected);
  });

  it("clamps days to the [1, MAX_INVITE_TTL_DAYS] window", () => {
    const tooLong = computeInviteExpiresAt({
      nowIso: "2026-01-01T00:00:00.000Z",
      days: 365,
    });
    const expectedMax = new Date(
      Date.parse("2026-01-01T00:00:00.000Z") + MAX_INVITE_TTL_DAYS * 86_400_000,
    ).toISOString();
    expect(tooLong).toBe(expectedMax);

    const tooShort = computeInviteExpiresAt({
      nowIso: "2026-01-01T00:00:00.000Z",
      days: 0,
    });
    const expectedMin = new Date(
      Date.parse("2026-01-01T00:00:00.000Z") + 1 * 86_400_000,
    ).toISOString();
    expect(tooShort).toBe(expectedMin);
  });

  it("falls back gracefully when nowIso is malformed", () => {
    expect(computeInviteExpiresAt({ nowIso: "not-a-date" })).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("isInviteUsable", () => {
  it("rejects already-accepted invites", () => {
    const ok = isInviteUsable({
      expiresAt: "2099-01-01T00:00:00Z",
      acceptedAt: "2026-01-01T00:00:00Z",
      nowIso: "2026-01-02T00:00:00Z",
    });
    expect(ok).toBe(false);
  });

  it("rejects expired invites", () => {
    const ok = isInviteUsable({
      expiresAt: "2026-01-01T00:00:00Z",
      acceptedAt: null,
      nowIso: "2026-01-02T00:00:00Z",
    });
    expect(ok).toBe(false);
  });

  it("accepts unexpired, unused invites", () => {
    const ok = isInviteUsable({
      expiresAt: "2099-01-01T00:00:00Z",
      acceptedAt: null,
      nowIso: "2026-01-01T00:00:00Z",
    });
    expect(ok).toBe(true);
  });

  it("rejects invites with malformed timestamps rather than letting them through", () => {
    const ok = isInviteUsable({
      expiresAt: "not-a-date",
      acceptedAt: null,
      nowIso: "2026-01-01T00:00:00Z",
    });
    expect(ok).toBe(false);
  });
});
