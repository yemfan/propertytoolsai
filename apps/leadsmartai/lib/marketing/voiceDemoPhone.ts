/**
 * Display + tel:-link helpers for the public Voice AI test-drive page.
 *
 * The phone number is sourced from `NEXT_PUBLIC_VOICE_DEMO_PHONE` (must be
 * NEXT_PUBLIC_ so it's bundled to the client-rendered hero). The env var is
 * authoritative — we don't hard-code a fallback number because rotating it
 * (e.g. when a Twilio number gets spam) needs to be a 1-line env change.
 *
 * Pure helpers — no I/O, no globals — so they're testable without spinning
 * up the dev server.
 */

export type VoiceDemoPhone = {
  /** Pretty form for display, e.g. "(415) 555-0123". Null when not configured. */
  display: string | null;
  /** tel:-href URI, e.g. "tel:+14155550123". Null when not configured. */
  telHref: string | null;
};

function digits(s: string): string {
  return s.replace(/\D/g, "");
}

/**
 * Format US phone for display. Accepts any input shape — "(415) 555-0123",
 * "+14155550123", "415.555.0123" — and returns the display form.
 *
 * Returns null if the input does not contain a valid 10-digit US number.
 */
export function formatVoiceDemoPhoneDisplay(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const d = digits(raw);
  // Accept either a leading "1" country code or a bare 10-digit number.
  const ten = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  if (ten.length !== 10) return null;
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

/**
 * Build the tel: URI from the same input. Always emits an E.164 form
 * (`tel:+1NXXNXXXXXX`) which iOS / Android dialers handle reliably.
 */
export function formatVoiceDemoPhoneTelHref(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const d = digits(raw);
  const ten = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  if (ten.length !== 10) return null;
  return `tel:+1${ten}`;
}

/**
 * One-shot resolver for the page header: returns both the display string and
 * the tel: href, or `{ display: null, telHref: null }` if the env var is
 * missing / malformed (the page renders a "book a private demo" fallback CTA
 * in that case).
 */
export function resolveVoiceDemoPhone(raw: string | null | undefined): VoiceDemoPhone {
  return {
    display: formatVoiceDemoPhoneDisplay(raw),
    telHref: formatVoiceDemoPhoneTelHref(raw),
  };
}
