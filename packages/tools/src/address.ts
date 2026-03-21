export function normalizeAddress(address: string): string {
  return address.trim().replace(/\s+/g, " ").toLowerCase();
}

export function validateAddress(address: string): { normalized: string; isValid: boolean } {
  const normalized = normalizeAddress(address);
  // Very lightweight validation for front-end / API pre-checks.
  // We only require some length and at least one number (street address).
  const hasEnoughChars = normalized.replace(/[^a-z0-9]/gi, "").length >= 6;
  const hasNumber = /\d/.test(normalized);
  return {
    normalized,
    isValid: hasEnoughChars && hasNumber,
  };
}

