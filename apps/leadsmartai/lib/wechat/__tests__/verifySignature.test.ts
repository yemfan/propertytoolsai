import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyTencentSignature } from "../verifySignature";

function sign(token: string, timestamp: string, nonce: string): string {
  const sorted = [token, timestamp, nonce].sort();
  return createHash("sha1").update(sorted.join(""), "utf8").digest("hex");
}

describe("verifyTencentSignature", () => {
  it("accepts a correctly-signed request", () => {
    const token = "dev_token";
    const timestamp = "1729512000";
    const nonce = "abc123";
    const signature = sign(token, timestamp, nonce);
    expect(verifyTencentSignature({ token, timestamp, nonce, signature })).toBe(true);
  });

  it("rejects a wrong signature", () => {
    expect(
      verifyTencentSignature({
        token: "dev_token",
        timestamp: "1729512000",
        nonce: "abc123",
        signature: "0".repeat(40),
      }),
    ).toBe(false);
  });

  it("rejects when any field is empty", () => {
    const filled = { token: "t", timestamp: "1", nonce: "n", signature: "s" };
    expect(verifyTencentSignature({ ...filled, token: "" })).toBe(false);
    expect(verifyTencentSignature({ ...filled, timestamp: "" })).toBe(false);
    expect(verifyTencentSignature({ ...filled, nonce: "" })).toBe(false);
    expect(verifyTencentSignature({ ...filled, signature: "" })).toBe(false);
  });

  it("is order-invariant on sort — Tencent spec sorts the three strings", () => {
    // Swap arg order in the test (timestamps / nonces come in arbitrary
    // order off Tencent's query string) and confirm the same signature
    // still validates.
    const token = "my_token";
    const signature = sign(token, "1000", "zzz");
    expect(
      verifyTencentSignature({
        token,
        timestamp: "1000",
        nonce: "zzz",
        signature,
      }),
    ).toBe(true);
    // Now imagine timestamp came after nonce lexicographically:
    const signature2 = sign(token, "2", "a");
    expect(
      verifyTencentSignature({
        token,
        timestamp: "2",
        nonce: "a",
        signature: signature2,
      }),
    ).toBe(true);
  });

  it("uses timing-safe comparison (mismatched-length signatures do not throw)", () => {
    // Manually constructed short signature — historically this triggered
    // a RangeError from Node's timingSafeEqual with mismatched-length
    // Buffers. Our wrapper length-checks first.
    expect(
      verifyTencentSignature({
        token: "t",
        timestamp: "1",
        nonce: "n",
        signature: "abc",
      }),
    ).toBe(false);
  });

  it("rejects a signature that differs only in casing", () => {
    const token = "t";
    const timestamp = "1";
    const nonce = "n";
    const sig = sign(token, timestamp, nonce);
    expect(
      verifyTencentSignature({
        token,
        timestamp,
        nonce,
        signature: sig.toUpperCase(),
      }),
    ).toBe(false);
  });
});
