import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed one-click-extend tokens for offer-expiration alert emails.
 *
 * Problem shape:
 *   The expiration alert email goes to the agent's inbox. When they
 *   tap "Extend 24h" we need to do a no-login-required write to the
 *   correct offer. That URL is the only auth — treat the token as a
 *   capability.
 *
 * Design:
 *   * Payload is a base64url-encoded JSON blob + `.` + HMAC-SHA256
 *     signature. Think lightweight JWT without the header/alg
 *     negotiation complexity.
 *   * Secret: OFFER_EXTEND_SECRET; falls back to CRON_SECRET. If
 *     both are unset, the feature is disabled (no token can be
 *     generated, no token can be verified).
 *   * Anti-replay: the payload pins `prevExpiresAt` — the offer's
 *     current expiration at the time the email was sent. On redeem
 *     we compare against the live offer; if it's changed (extended
 *     already, accepted, expired, cancelled), we reject. This beats
 *     maintaining a "used tokens" table for a low-volume feature.
 *   * Lifetime: we also refuse tokens older than LIFETIME_HOURS
 *     (default 72h). A stale token from a reminder email a week
 *     later shouldn't be usable.
 */

export type OfferExtendTokenPayload = {
  kind: "buyer" | "listing";
  offerId: string;
  agentId: string;
  prevExpiresAt: string;
  extendHours: number;
  issuedAt: string;
};

const LIFETIME_HOURS = 72;

export type ExtendTokenVerifyError =
  | "disabled"
  | "malformed"
  | "bad_signature"
  | "expired"
  | "payload_invalid";

// The `?: never` markers on the off-branch fields are a workaround
// for the repo's `strict: false` tsconfig: under non-strict mode, TS
// won't narrow `if (!r.ok)` on a pure discriminated union, so any
// caller using `!r.ok` then `r.error` would fail to compile. Adding
// the marker lets `r.error` be typed `ExtendTokenVerifyError |
// undefined` on the whole union — no narrowing needed.
export type VerifyResult =
  | { ok: true; payload: OfferExtendTokenPayload; error?: never }
  | { ok: false; error: ExtendTokenVerifyError; payload?: never };

export function isOfferExtendEnabled(): boolean {
  return Boolean(resolveSecret());
}

export function signOfferExtendToken(payload: OfferExtendTokenPayload): string | null {
  const secret = resolveSecret();
  if (!secret) return null;
  const body = base64UrlEncode(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = base64UrlEncode(
    createHmac("sha256", secret).update(body).digest(),
  );
  return `${body}.${sig}`;
}

export function verifyOfferExtendToken(
  token: string,
  opts?: { nowIso?: string },
): VerifyResult {
  const secret = resolveSecret();
  if (!secret) return { ok: false, error: "disabled" };

  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, error: "malformed" };
  const [body, sig] = parts;
  if (!body || !sig) return { ok: false, error: "malformed" };

  const expectedSig = base64UrlEncode(
    createHmac("sha256", secret).update(body).digest(),
  );
  if (!safeEq(sig, expectedSig)) return { ok: false, error: "bad_signature" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(base64UrlDecode(body).toString("utf8"));
  } catch {
    return { ok: false, error: "payload_invalid" };
  }
  if (!isValidPayload(parsed)) return { ok: false, error: "payload_invalid" };

  // Lifetime check.
  const nowMs = opts?.nowIso ? new Date(opts.nowIso).getTime() : Date.now();
  const issuedMs = new Date(parsed.issuedAt).getTime();
  if (!Number.isFinite(issuedMs)) return { ok: false, error: "payload_invalid" };
  if (nowMs - issuedMs > LIFETIME_HOURS * 3600 * 1000) {
    return { ok: false, error: "expired" };
  }

  return { ok: true, payload: parsed };
}

function isValidPayload(v: unknown): v is OfferExtendTokenPayload {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Record<string, unknown>;
  if (p.kind !== "buyer" && p.kind !== "listing") return false;
  if (typeof p.offerId !== "string" || !p.offerId) return false;
  if (typeof p.agentId !== "string" || !p.agentId) return false;
  if (typeof p.prevExpiresAt !== "string" || !p.prevExpiresAt) return false;
  if (typeof p.extendHours !== "number" || !Number.isFinite(p.extendHours)) return false;
  if (p.extendHours <= 0 || p.extendHours > 168) return false; // clamp to 1 week max
  if (typeof p.issuedAt !== "string" || !p.issuedAt) return false;
  return true;
}

function resolveSecret(): string | null {
  const s =
    process.env.OFFER_EXTEND_SECRET?.trim() || process.env.CRON_SECRET?.trim() || "";
  return s || null;
}

function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(s: string): Buffer {
  // Pad if necessary
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function safeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}
