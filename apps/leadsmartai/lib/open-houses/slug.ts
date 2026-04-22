/**
 * Short URL-safe slugs for public open-house sign-in pages.
 *
 * 12 chars of [a-zA-Z0-9] = 62^12 combinations. Collision risk at
 * our scale is negligible; unique constraint on the DB column is
 * the ultimate guard. On collision (vanishingly rare), the caller
 * retries — handled in the service layer.
 *
 * Excluded chars: confusing lookalikes (0/O, 1/l/I) aren't stripped
 * here because the slug is never read aloud — agents scan a QR code
 * or click a link. Saving those 6 bits of entropy isn't worth it.
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function generateOpenHouseSlug(length: number = 12): string {
  const bytes = new Uint8Array(length);
  // Use crypto.getRandomValues — available in Node 20+ (edge + node runtimes).
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}
