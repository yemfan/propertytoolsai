/**
 * Pure helpers for Twilio Voice status-callback webhook payloads.
 *
 * Twilio sends an x-www-form-urlencoded POST as the call progresses
 * through queued → ringing → in-progress → completed/failed/etc.
 * The webhook handler at /api/voice/status-callback verifies the
 * signature, parses the form body into a CallStatusUpdate, and
 * upserts the lead_calls row + appends a lead_call_events entry.
 *
 * This file holds the pure parsing + status-mapping logic so vitest
 * hits it without HTTP / DB.
 */

/** Twilio's CallStatus values, per the Voice API docs. */
export type TwilioCallStatus =
  | "queued"
  | "ringing"
  | "in-progress"
  | "completed"
  | "busy"
  | "no-answer"
  | "canceled"
  | "failed";

/** Our canonical status stored on lead_calls. Keeps the existing
 *  inbound-call vocabulary so the timeline reads consistently. */
export type CanonicalCallStatus =
  | "queued"
  | "ringing"
  | "in_progress"
  | "completed"
  | "missed"
  | "failed";

export type CallStatusUpdate = {
  callSid: string;
  status: CanonicalCallStatus;
  durationSeconds: number | null;
  /** Free-form passthrough — useful in the lead_call_events payload
   *  for forensics ("AnsweredBy = human", recording URL, etc.). */
  raw: Record<string, string>;
};

/**
 * Parse a Twilio status-callback form body into our update shape.
 * Returns null when the payload doesn't look like a Voice callback
 * (missing CallSid or unknown CallStatus) — the route 200s in that
 * case to prevent retry storms.
 */
export function parseTwilioStatusCallback(
  formParams: Record<string, string>,
): CallStatusUpdate | null {
  const callSid = (formParams.CallSid ?? "").trim();
  if (!callSid) return null;

  const rawStatus = (formParams.CallStatus ?? "").trim().toLowerCase() as TwilioCallStatus;
  const canonical = mapStatus(rawStatus);
  if (!canonical) return null;

  const duration = parseDuration(formParams.CallDuration);

  return {
    callSid,
    status: canonical,
    durationSeconds: duration,
    raw: formParams,
  };
}

function mapStatus(s: TwilioCallStatus | string): CanonicalCallStatus | null {
  switch (s) {
    case "queued":
      return "queued";
    case "ringing":
      return "ringing";
    case "in-progress":
      return "in_progress";
    case "completed":
      return "completed";
    case "busy":
    case "no-answer":
    case "canceled":
      return "missed";
    case "failed":
      return "failed";
    default:
      return null;
  }
}

function parseDuration(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}
