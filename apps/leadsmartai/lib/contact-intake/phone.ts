/** US display phone; returns null if not 10 digits. */
export function formatUsPhoneDigits(input: string | null | undefined): string | null {
  if (input == null) return null;
  const digits = String(input).replace(/\D/g, "").slice(0, 10);
  if (digits.length !== 10) return null;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
