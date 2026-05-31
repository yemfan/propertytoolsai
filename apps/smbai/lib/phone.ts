/**
 * Phone-number normalization to E.164.
 *
 * The receptionist resolves which business a call belongs to by matching the
 * dialed number against `organizations.twilio_number`. A fat-fingered number
 * (e.g. a dropped digit) silently breaks that match and the voice agent can't
 * book anything — so the number must be validated + normalized before it's
 * stored, not taken as free text.
 */

export type PhoneResult = { ok: true; value: string } | { ok: false; error: string };

const E164_HINT = "Use E.164 format — a US number as 10 digits or +1 then 10 digits (e.g. +16265551234).";

/**
 * Normalize loose user input ("(626) 669-4566", "626-669-4566", "+1 626 669 4566")
 * to strict E.164 ("+16266694566"). US numbers may omit the country code; any
 * other country must be entered with a leading "+". Rejects anything that isn't
 * a plausible 10-digit US number or a 11–15 digit international number — which
 * is what catches a dropped/extra digit before it reaches the database.
 */
export function normalizePhoneE164(input: string): PhoneResult {
  const raw = (input || "").trim();
  if (!raw) return { ok: false, error: "Enter a phone number." };

  const hadPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");

  // US, no country code: exactly 10 digits → +1XXXXXXXXXX
  if (!hadPlus && digits.length === 10) return { ok: true, value: `+1${digits}` };

  // US with country code: 1 + 10 digits → +1XXXXXXXXXX
  if (digits.length === 11 && digits.startsWith("1")) return { ok: true, value: `+${digits}` };

  // International: must be entered with "+", 11–15 digits per E.164.
  if (hadPlus && digits.length >= 11 && digits.length <= 15) return { ok: true, value: `+${digits}` };

  return { ok: false, error: `That doesn't look like a valid phone number. ${E164_HINT}` };
}
