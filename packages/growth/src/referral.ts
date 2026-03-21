/**
 * Referral code generation + validation (no I/O).
 */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateReferralCode(length = 8): string {
  let out = "";
  const bytes = typeof crypto !== "undefined" && crypto.getRandomValues ? new Uint8Array(length) : null;
  if (bytes) {
    crypto.getRandomValues(bytes);
    for (let i = 0; i < length; i++) {
      out += ALPHABET[bytes[i] % ALPHABET.length];
    }
    return out;
  }
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export function normalizeReferralCode(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function isValidReferralCodeFormat(code: string): boolean {
  const c = normalizeReferralCode(code);
  return c.length >= 6 && c.length <= 12 && /^[A-Z0-9]+$/.test(c);
}

export function referralQueryParamNames(): string[] {
  return ["ref", "referral", "r"];
}

export function extractReferralFromSearchParams(
  params: URLSearchParams | Record<string, string | string[] | undefined>
): string | null {
  const names = referralQueryParamNames();
  if (params instanceof URLSearchParams) {
    for (const n of names) {
      const v = params.get(n);
      if (v) {
        const c = normalizeReferralCode(v);
        if (c) return c;
      }
    }
    return null;
  }
  for (const n of names) {
    const raw = params[n];
    const v = Array.isArray(raw) ? raw[0] : raw;
    if (v) {
      const c = normalizeReferralCode(v);
      if (c) return c;
    }
  }
  return null;
}
