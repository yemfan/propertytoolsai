/**
 * US phone helpers: national 10-digit numbers, optional leading country code `1` / `+1`.
 * Stored/display format: `(555) 555-5555` (same as consumer signup).
 */

/** National digits only (0–10 chars); strips a leading `1` when the input has 11 digits. */
export function usPhoneNationalDigits(input: string): string {
  let d = String(input).replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d.slice(0, 10);
}

/** Progressive formatting for controlled `<input type="tel" />` fields. */
export function formatUsPhoneInput(input: string): string {
  const d = usPhoneNationalDigits(input);
  if (!d) return "";
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export function isValidUsPhone(input: string): boolean {
  return usPhoneNationalDigits(input).length === 10;
}

/** Canonical stored form, or `null` if not exactly 10 national digits. */
export function formatUsPhoneStored(input: string): string | null {
  const d = usPhoneNationalDigits(input);
  if (d.length !== 10) return null;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}
