import { randomBytes } from "crypto";

/**
 * 14-char URL-safe slug. Base62 ~ 62^14 ≈ 1.2e25 keyspace — no
 * realistic risk of collision across even heavy senders. Uses a
 * no-ambiguous-chars alphabet so the recipient can, worst case,
 * hand-type it without confusing `0` / `O` / `1` / `l`.
 */
export function generatePostcardSlug(): string {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(14);
  let out = "";
  for (let i = 0; i < 14; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}
