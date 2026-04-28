/**
 * Pure shareable-token helpers. Same shape as reviews/teams —
 * 32 bytes base64url raw, SHA-256 hex hash. Stored hashed; raw
 * only ever leaves the server in the URL the agent shares with
 * the seller.
 */

import { createHash, randomBytes } from "node:crypto";

export type GeneratedShareToken = {
  rawToken: string;
  tokenHash: string;
};

export function generateShareToken(): GeneratedShareToken {
  const raw = randomBytes(32).toString("base64url");
  return { rawToken: raw, tokenHash: hashShareToken(raw) };
}

export function hashShareToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
