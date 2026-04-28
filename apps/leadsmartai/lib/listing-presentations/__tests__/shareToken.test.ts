import { describe, expect, it } from "vitest";
import { generateShareToken, hashShareToken } from "../shareToken";

describe("generateShareToken", () => {
  it("returns a base64url raw + matching SHA-256 hex hash", () => {
    const t = generateShareToken();
    expect(t.rawToken).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(t.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashShareToken(t.rawToken)).toBe(t.tokenHash);
  });

  it("never collides across calls", () => {
    const a = generateShareToken();
    const b = generateShareToken();
    expect(a.rawToken).not.toBe(b.rawToken);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });

  it("hashShareToken is deterministic", () => {
    expect(hashShareToken("abc")).toBe(hashShareToken("abc"));
    expect(hashShareToken("abc")).not.toBe(hashShareToken("abd"));
  });
});
