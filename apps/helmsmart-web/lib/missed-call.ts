/**
 * Pure decision logic for the missed-call text-back, kept dependency-free so it
 * can be unit-tested without the webhook's I/O (Twilio, Supabase). The webhook
 * (app/api/retell/webhook/route.ts) wraps this with the actual send + logging.
 */

/** Retell disconnect reasons that mean the caller reached a machine, not a person. */
const VOICEMAIL_DISCONNECTS = new Set(["voicemail_reached", "machine_detected"]);

/** ...and reasons that mean the call never connected / failed outright. */
const FAILED_DISCONNECTS = new Set([
  "dial_no_answer",
  "dial_busy",
  "dial_failed",
  "inactivity",
  "registered_call_timeout",
]);

export type MissedVerdict = { status: "missed" | "voicemail" };

/**
 * Decide whether an ended inbound call should trigger a text-back, and how to log
 * it. We text back when the caller wasn't actually served:
 *   - voicemail / answering machine          → status "voicemail"
 *   - failed / no-answer / timeout disconnect → status "missed"
 *   - any `error*` disconnect reason          → status "missed"
 *   - the caller hung up on the AI without ever speaking (zero user turns) → "missed"
 *
 * A real conversation (≥1 user turn ending in a clean hangup/transfer) returns
 * null: it's already covered by the owner follow-up task, so we don't text "we
 * missed you" to someone the AI actually talked to. Voicemail and failure/error
 * reasons take precedence over engagement — an errored or machine-answered call
 * still warrants a text even if some turns were exchanged.
 */
export function classifyMissed(args: {
  disconnectionReason: string;
  userTurns: number;
}): MissedVerdict | null {
  const reason = args.disconnectionReason;
  if (VOICEMAIL_DISCONNECTS.has(reason)) return { status: "voicemail" };
  if (reason.startsWith("error") || FAILED_DISCONNECTS.has(reason)) return { status: "missed" };
  if (args.userTurns === 0) return { status: "missed" };
  return null;
}
