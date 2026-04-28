/**
 * Pure helpers for review-request tokens.
 *
 * Same shape as lib/teams/inviteToken — 32-byte base64url raw,
 * SHA-256 hex hash. Stored hashed; raw is only ever in the
 * outbound email/SMS link. On the public landing page submit, we
 * hash again and look up.
 */

import { createHash, randomBytes } from "node:crypto";

export const DEFAULT_REVIEW_TTL_DAYS = 60;
export const MAX_REVIEW_TTL_DAYS = 180;

export type GeneratedToken = {
  rawToken: string;
  tokenHash: string;
};

export function generateReviewToken(): GeneratedToken {
  const raw = randomBytes(32).toString("base64url");
  return { rawToken: raw, tokenHash: hashReviewToken(raw) };
}

export function hashReviewToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function computeReviewExpiresAt(args: {
  nowIso: string;
  days?: number;
}): string {
  const days = clampDays(args.days);
  const ms = Date.parse(args.nowIso);
  if (!Number.isFinite(ms)) {
    return new Date(Date.now() + DEFAULT_REVIEW_TTL_DAYS * 86_400_000).toISOString();
  }
  return new Date(ms + days * 86_400_000).toISOString();
}

export function isReviewRequestUsable(args: {
  expiresAt: string;
  respondedAt: string | null;
  nowIso: string;
}): boolean {
  if (args.respondedAt) return false;
  const exp = Date.parse(args.expiresAt);
  const now = Date.parse(args.nowIso);
  if (!Number.isFinite(exp) || !Number.isFinite(now)) return false;
  return exp > now;
}

function clampDays(days: number | undefined): number {
  if (days == null || !Number.isFinite(days)) return DEFAULT_REVIEW_TTL_DAYS;
  return Math.min(Math.max(Math.round(days), 7), MAX_REVIEW_TTL_DAYS);
}
