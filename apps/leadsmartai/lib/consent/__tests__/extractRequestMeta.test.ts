import { describe, expect, it } from "vitest";

import { extractRequestMeta } from "@/lib/consent/extractRequestMeta";

function reqWith(headers: Record<string, string>): Request {
  return new Request("https://example.com/api/contact", { method: "POST", headers });
}

describe("extractRequestMeta — IP resolution", () => {
  it("uses x-forwarded-for first hop when present", () => {
    expect(
      extractRequestMeta(
        reqWith({ "x-forwarded-for": "203.0.113.1, 70.41.3.18, 150.172.238.178" }),
      ).ipAddress,
    ).toBe("203.0.113.1");
  });

  it("trims whitespace from xff entries", () => {
    expect(
      extractRequestMeta(reqWith({ "x-forwarded-for": "  203.0.113.1  , 70.41.3.18" }))
        .ipAddress,
    ).toBe("203.0.113.1");
  });

  it("falls back to x-real-ip when xff is absent", () => {
    expect(
      extractRequestMeta(reqWith({ "x-real-ip": "203.0.113.42" })).ipAddress,
    ).toBe("203.0.113.42");
  });

  it("falls back to cf-connecting-ip when xff + x-real-ip are absent", () => {
    expect(
      extractRequestMeta(reqWith({ "cf-connecting-ip": "203.0.113.99" })).ipAddress,
    ).toBe("203.0.113.99");
  });

  it("prefers xff over x-real-ip + cf when multiple are present", () => {
    expect(
      extractRequestMeta(
        reqWith({
          "x-forwarded-for": "203.0.113.1",
          "x-real-ip": "10.0.0.1",
          "cf-connecting-ip": "10.0.0.2",
        }),
      ).ipAddress,
    ).toBe("203.0.113.1");
  });

  it("returns null when no IP-related headers are present", () => {
    expect(extractRequestMeta(reqWith({})).ipAddress).toBeNull();
  });

  it("treats empty xff as missing (doesn't return empty string)", () => {
    expect(extractRequestMeta(reqWith({ "x-forwarded-for": "" })).ipAddress).toBeNull();
  });

  it("supports IPv6 addresses", () => {
    expect(
      extractRequestMeta(reqWith({ "x-forwarded-for": "2001:db8::1, 70.41.3.18" })).ipAddress,
    ).toBe("2001:db8::1");
  });

  it("truncates pathologically long IP values to 64 chars", () => {
    const long = "x".repeat(200);
    const out = extractRequestMeta(reqWith({ "x-forwarded-for": long })).ipAddress;
    expect(out?.length).toBe(64);
  });
});

describe("extractRequestMeta — user agent", () => {
  it("returns the UA header when present", () => {
    expect(
      extractRequestMeta(reqWith({ "user-agent": "Mozilla/5.0 (Macintosh)" })).userAgent,
    ).toBe("Mozilla/5.0 (Macintosh)");
  });

  it("returns null when UA is absent", () => {
    expect(extractRequestMeta(reqWith({})).userAgent).toBeNull();
  });

  it("truncates absurdly long UA to 1024 chars (defensive against header abuse)", () => {
    const long = "X".repeat(2000);
    const out = extractRequestMeta(reqWith({ "user-agent": long })).userAgent;
    expect(out?.length).toBe(1024);
  });
});
