/**
 * App-local SMS intent helpers for the appointment self-service flow.
 *
 * Kept OUT of the shared @helm/dna-communication safety helpers on purpose: the
 * shared shouldStopMessaging() treats a bare "cancel" as a carrier opt-out, which
 * is correct for marketing messaging. Here — replying to an appointment text — we
 * want "cancel" to START an appointment cancellation (gated behind a YES
 * confirmation), so we detect it locally and run it BEFORE the opt-out branch,
 * leaving the real opt-out keywords (STOP / UNSUBSCRIBE / END / QUIT) untouched.
 */

/** True when the message expresses intent to cancel an appointment. */
export function isCancelRequest(body: string): boolean {
  return /\bcancel(l?ed|l?ing|lation)?\b/i.test(body ?? "");
}

/** True when the message is a short affirmative ("yes", "ok", "confirm", …). */
export function isAffirmative(body: string): boolean {
  const t = (body ?? "").trim().toLowerCase().replace(/[.!]+$/, "");
  return /^(y|yes|yes please|yeah|yep|yup|ok|okay|sure|confirm|confirmed|correct|do it|go ahead)$/.test(t);
}
