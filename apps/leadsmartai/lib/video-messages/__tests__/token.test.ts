import { describe, expect, it } from "vitest";
import {
  generateVideoToken,
  hashIp,
  hashVideoToken,
} from "../token";

describe("generateVideoToken", () => {
  it("returns base64url raw + matching SHA-256 hex hash", () => {
    const t = generateVideoToken();
    expect(t.rawToken).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(t.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashVideoToken(t.rawToken)).toBe(t.tokenHash);
  });

  it("never collides", () => {
    const a = generateVideoToken();
    const b = generateVideoToken();
    expect(a.rawToken).not.toBe(b.rawToken);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });
});

describe("hashIp", () => {
  it("returns a 64-char hex hash", () => {
    expect(hashIp("1.2.3.4")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is deterministic — same IP → same hash", () => {
    expect(hashIp("1.2.3.4")).toBe(hashIp("1.2.3.4"));
  });

  it("returns null on null/empty", () => {
    expect(hashIp(null)).toBeNull();
    expect(hashIp(undefined)).toBeNull();
    expect(hashIp("")).toBeNull();
    expect(hashIp("   ")).toBeNull();
  });

  it("differs for different IPs", () => {
    expect(hashIp("1.2.3.4")).not.toBe(hashIp("1.2.3.5"));
  });
});
