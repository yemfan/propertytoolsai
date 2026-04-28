/**
 * Svix webhook signature verification.
 *
 * Resend delivers webhooks via Svix. Each request carries three
 * headers:
 *   - svix-id: unique delivery id (also used as our dedupe key)
 *   - svix-timestamp: unix seconds when the event was generated
 *   - svix-signature: space-separated list of versioned signatures,
 *     e.g. "v1,base64sig v1,base64sig2" (multiple signatures during
 *     secret rotation; any matching one passes)
 *
 * Verification:
 *   1. signedContent = `${svixId}.${svixTimestamp}.${rawBody}`
 *   2. secret = base64-decode the part after `whsec_`
 *   3. expected = base64( HMAC-SHA256(secret, signedContent) )
 *   4. timing-safe compare against each `v1,...` from the header
 *
 * We also reject events older than `toleranceSeconds` (default 5min)
 * to mitigate replay attacks. Svix does the same in their official
 * SDK — we mirror it here so we don't have to take on the dep.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export type VerifyResult = {
  ok: boolean;
  /** Populated when ok is false. Empty string on success — keeps the
   *  shape simple under strict:false TS where discriminated union
   *  narrowing isn't available. */
  reason: string;
};

export type VerifyArgs = {
  secret: string;
  rawBody: string;
  svixId: string | null;
  svixTimestamp: string | null;
  svixSignature: string | null;
  /** When set, treat events older than this many seconds as invalid.
   *  Defaults to 300 (5 min). Pass null to disable (tests). */
  toleranceSeconds?: number | null;
  /** Override Date.now() for tests. Returns ms since epoch. */
  nowMs?: () => number;
};

export function verifySvixSignature(args: VerifyArgs): VerifyResult {
  const { secret, rawBody, svixId, svixTimestamp, svixSignature } = args;
  if (!svixId || !svixTimestamp || !svixSignature) {
    return { ok: false, reason: "missing svix headers" };
  }
  if (!secret || !secret.startsWith("whsec_")) {
    return { ok: false, reason: "secret must start with whsec_" };
  }

  const tolerance = args.toleranceSeconds === undefined ? 300 : args.toleranceSeconds;
  if (tolerance != null && tolerance > 0) {
    const tsSec = Number(svixTimestamp);
    if (!Number.isFinite(tsSec)) return { ok: false, reason: "bad timestamp" };
    const nowSec = Math.floor((args.nowMs?.() ?? Date.now()) / 1000);
    if (Math.abs(nowSec - tsSec) > tolerance) {
      return { ok: false, reason: "timestamp outside tolerance" };
    }
  }

  let secretBytes: Buffer;
  try {
    secretBytes = Buffer.from(secret.slice("whsec_".length), "base64");
  } catch {
    return { ok: false, reason: "secret not base64" };
  }
  if (secretBytes.length === 0) return { ok: false, reason: "empty decoded secret" };

  const signed = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expected = createHmac("sha256", secretBytes).update(signed).digest("base64");

  // Header is space-separated: "v1,sigA v1,sigB". Try each.
  const candidates = svixSignature.split(" ").filter(Boolean);
  for (const cand of candidates) {
    const [version, sig] = cand.split(",");
    if (version !== "v1" || !sig) continue;
    if (constantTimeMatch(expected, sig)) return { ok: true, reason: "" };
  }
  return { ok: false, reason: "no matching signature" };
}

function constantTimeMatch(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  try {
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}
