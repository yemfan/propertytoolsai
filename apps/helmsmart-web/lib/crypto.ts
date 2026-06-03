/**
 * AES-256-GCM encryption for sensitive values (e.g. Plaid access tokens).
 *
 * Requires ENCRYPTION_KEY env var: 64 hex chars (32 bytes).
 * Generate with: openssl rand -hex 32
 *
 * Format: iv(24 hex):tag(32 hex):ciphertext(hex)
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY must be set to 64 hex characters (32 bytes). " +
        "Generate with: openssl rand -hex 32"
    );
  }
  return Buffer.from(hex, "hex");
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag(); // 128-bit auth tag
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(encryptedStr: string): string {
  const key = getKey();
  const parts = encryptedStr.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted string format");
  const [ivHex, tagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return (
    decipher.update(ciphertext, undefined, "utf8") + decipher.final("utf8")
  );
}
