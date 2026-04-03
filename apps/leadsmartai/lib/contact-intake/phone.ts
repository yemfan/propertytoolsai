import { formatUsPhoneStored } from "@/lib/usPhone";

/** US display phone; returns null if not 10 national digits (supports pasted `+1…`). */
export function formatUsPhoneDigits(input: string | null | undefined): string | null {
  if (input == null) return null;
  return formatUsPhoneStored(String(input));
}
