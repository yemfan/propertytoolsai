/**
 * Normalize a bank-transaction payee into a stable key for category memory.
 *
 * The goal isn't a pretty name — it's that the SAME merchant always maps to the
 * SAME key, so "STARBUCKS #1234" and "STARBUCKS #0987" both become "starbucks".
 * We drop digit runs (store numbers, dates, phone numbers) and punctuation, and
 * lowercase + collapse whitespace.
 */
export function normalizePayee(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .replace(/\d{2,}/g, " ") // store numbers, dates, phone numbers
    .replace(/[^a-z\s]/g, " ") // punctuation, symbols
    .replace(/\s+/g, " ")
    .trim();
}
