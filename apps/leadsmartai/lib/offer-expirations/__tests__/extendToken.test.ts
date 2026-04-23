import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  isOfferExtendEnabled,
  signOfferExtendToken,
  verifyOfferExtendToken,
} from "../extendToken";

const ORIGINAL_ENV = { ...process.env };

function basePayload() {
  return {
    kind: "buyer" as const,
    offerId: "offer-123",
    agentId: "agent-456",
    prevExpiresAt: "2026-05-01T12:00:00Z",
    extendHours: 24,
    issuedAt: new Date().toISOString(),
  };
}

describe("extendToken", () => {
  beforeEach(() => {
    process.env.OFFER_EXTEND_SECRET = "test-secret-nobody-guess-me";
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("reports disabled when no secret is set", () => {
    delete process.env.OFFER_EXTEND_SECRET;
    delete process.env.CRON_SECRET;
    expect(isOfferExtendEnabled()).toBe(false);
    expect(signOfferExtendToken(basePayload())).toBeNull();
    expect(verifyOfferExtendToken("x.y")).toEqual({ ok: false, error: "disabled" });
  });

  it("signs + verifies a valid token round-trip", () => {
    const token = signOfferExtendToken(basePayload())!;
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    const res = verifyOfferExtendToken(token);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.payload.offerId).toBe("offer-123");
      expect(res.payload.extendHours).toBe(24);
    }
  });

  it("rejects tampered payloads (bad signature)", () => {
    const token = signOfferExtendToken(basePayload())!;
    // Flip one byte in the payload half — signature no longer matches.
    const [body, sig] = token.split(".");
    const tampered = body.slice(0, -1) + (body.slice(-1) === "A" ? "B" : "A") + "." + sig;
    expect(verifyOfferExtendToken(tampered)).toMatchObject({
      ok: false,
      error: "bad_signature",
    });
  });

  it("rejects tokens with swapped signatures", () => {
    const a = signOfferExtendToken(basePayload())!;
    const b = signOfferExtendToken({ ...basePayload(), offerId: "other" })!;
    const [aBody] = a.split(".");
    const [, bSig] = b.split(".");
    expect(verifyOfferExtendToken(`${aBody}.${bSig}`)).toMatchObject({
      ok: false,
      error: "bad_signature",
    });
  });

  it("rejects malformed tokens missing the dot separator", () => {
    expect(verifyOfferExtendToken("nodots")).toMatchObject({
      ok: false,
      error: "malformed",
    });
  });

  it("rejects tokens issued more than 72 hours ago", () => {
    const issuedAt = new Date(Date.now() - 80 * 3600 * 1000).toISOString();
    const token = signOfferExtendToken({ ...basePayload(), issuedAt })!;
    expect(verifyOfferExtendToken(token)).toMatchObject({ ok: false, error: "expired" });
  });

  it("accepts fresh tokens (within the 72h lifetime)", () => {
    const issuedAt = new Date(Date.now() - 10 * 3600 * 1000).toISOString();
    const token = signOfferExtendToken({ ...basePayload(), issuedAt })!;
    expect(verifyOfferExtendToken(token).ok).toBe(true);
  });

  it("rejects bad payload shapes even with valid signature", () => {
    // We can't easily produce this without crossing our own API; simulate
    // by signing a payload we know will fail isValidPayload after the
    // scheme changes. For MVP: check that kind must be buyer|listing.
    expect(
      // @ts-expect-error intentional wrong-shape
      signOfferExtendToken({ ...basePayload(), kind: "other" }),
    ).not.toBeNull();
    const badToken =
      // @ts-expect-error intentional wrong-shape
      signOfferExtendToken({ ...basePayload(), kind: "other" })!;
    expect(verifyOfferExtendToken(badToken)).toMatchObject({
      ok: false,
      error: "payload_invalid",
    });
  });

  it("falls back to CRON_SECRET when OFFER_EXTEND_SECRET is unset", () => {
    delete process.env.OFFER_EXTEND_SECRET;
    process.env.CRON_SECRET = "cron-secret";
    expect(isOfferExtendEnabled()).toBe(true);
    const token = signOfferExtendToken(basePayload())!;
    expect(verifyOfferExtendToken(token).ok).toBe(true);
  });
});
