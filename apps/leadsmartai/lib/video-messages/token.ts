/**
 * Pure share-token helpers for video messages.
 *
 * Same shape as teams / reviews / listing-presentations:
 * 32-byte base64url raw + SHA-256 hex hash. Stored hashed; raw
 * only ever leaves the server in the email thumbnail link.
 */

import { createHash, randomBytes } from "node:crypto";

export type GeneratedShareToken = {
  rawToken: string;
  tokenHash: string;
};

export function generateVideoToken(): GeneratedShareToken {
  const raw = randomBytes(32).toString("base64url");
  return { rawToken: raw, tokenHash: hashVideoToken(raw) };
}

export function hashVideoToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Hash an IP address for privacy-preserving unique-viewer counting.
 * Same SHA-256 used for tokens — different domain, but the same
 * crypto primitive is fine for our purposes (we just need
 * "different IPs → different hashes" with no reverse lookup).
 */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const trimmed = String(ip).trim();
  if (!trimmed) return null;
  return createHash("sha256").update(trimmed).digest("hex");
}
