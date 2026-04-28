/**
 * Pure invite-token helpers. The team_invites table stores the
 * SHA-256 hash of the token; the raw token only leaves the server in
 * the invite email. On accept, we hash again and compare.
 *
 * Token format: 32 bytes of crypto random, base64url-encoded
 * (no padding) → ~43 chars. Long enough that brute-forcing the full
 * (token, team_id) tuple is infeasible.
 *
 * Why hash-on-server: if the team_invites table leaks, a raw token
 * would let an attacker accept any pending invite. Hashed, the
 * attacker has to break SHA-256 first.
 */

import { createHash, randomBytes } from "node:crypto";

/** Default expiry for new invites — 14 days. */
export const DEFAULT_INVITE_TTL_DAYS = 14;

/** Maximum allowed expiry — 60 days. Anything beyond is product
 *  hygiene risk (a forgotten invite that gets accepted six months
 *  later by someone who doesn't remember it). */
export const MAX_INVITE_TTL_DAYS = 60;

export type GeneratedInvite = {
  /** Show this to the inviter once (in the email link). Never stored. */
  rawToken: string;
  /** Persist this. */
  tokenHash: string;
};

export function generateInviteToken(): GeneratedInvite {
  const raw = randomBytes(32).toString("base64url");
  return {
    rawToken: raw,
    tokenHash: hashInviteToken(raw),
  };
}

export function hashInviteToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function computeInviteExpiresAt(args: {
  nowIso: string;
  days?: number;
}): string {
  const days = clampTtl(args.days);
  const ms = Date.parse(args.nowIso);
  if (!Number.isFinite(ms)) {
    // Defensive: fall back to "now + default". Caller should pass valid ISO.
    return new Date(Date.now() + DEFAULT_INVITE_TTL_DAYS * 86_400_000).toISOString();
  }
  return new Date(ms + days * 86_400_000).toISOString();
}

export function isInviteUsable(args: {
  expiresAt: string;
  acceptedAt: string | null;
  nowIso: string;
}): boolean {
  if (args.acceptedAt) return false;
  const exp = Date.parse(args.expiresAt);
  const now = Date.parse(args.nowIso);
  if (!Number.isFinite(exp) || !Number.isFinite(now)) return false;
  return exp > now;
}

function clampTtl(days: number | undefined): number {
  if (days == null || !Number.isFinite(days)) return DEFAULT_INVITE_TTL_DAYS;
  return Math.min(Math.max(Math.round(days), 1), MAX_INVITE_TTL_DAYS);
}
