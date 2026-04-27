/**
 * Pure parser for Twilio call-status webhooks fired against the outbound
 * voice-AI demo callback URL. Lives in its own file (no `server-only`)
 * so vitest hits the parsing without the shim.
 *
 * Twilio status spec: https://www.twilio.com/docs/voice/api/call-resource#callresource-statuscallback
 *
 * Status flow for a typical demo call:
 *
 *   queued → ringing → in-progress → completed
 *
 * Failure modes:
 *
 *   queued → busy            (recipient line is busy)
 *   queued → no-answer       (rang out — they didn't pick up)
 *   queued → failed          (network / config — Twilio couldn't even attempt)
 *   queued → canceled        (we hung up before they answered)
 *
 * We log every status to `contact_events` so the sales team has a clean
 * timeline ("AI called Sarah at 14:02:11; Sarah picked up; call lasted
 * 4m32s"). Filtering happens at the dashboard query, not here.
 */

export type VoiceDemoCallStatus =
  | "queued"
  | "initiated"
  | "ringing"
  | "in-progress"
  | "completed"
  | "busy"
  | "no-answer"
  | "failed"
  | "canceled";

const KNOWN_STATUSES: ReadonlySet<string> = new Set([
  "queued",
  "initiated",
  "ringing",
  "in-progress",
  "completed",
  "busy",
  "no-answer",
  "failed",
  "canceled",
]);

export type ParsedDemoCallStatus = {
  callSid: string;
  status: VoiceDemoCallStatus;
  /** Seconds. Only meaningful for `completed`. Null otherwise. */
  durationSeconds: number | null;
  from: string | null;
  to: string | null;
  /** Twilio supplies this when recording was enabled — null today, but parsed for future use. */
  recordingUrl: string | null;
  /** Twilio supplies this for `failed` / `busy` etc. */
  errorCode: string | null;
};

function pick(form: Record<string, string>, key: string): string | null {
  const v = form[key];
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

function parseDuration(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Parse Twilio's form-encoded status webhook body. Returns null if the body
 * is missing the minimum required fields (`CallSid` + `CallStatus`).
 *
 * Treats unknown statuses defensively — the field is preserved as a string
 * but passed through the type narrowing only when it's in the known set.
 */
export function parseStatusCallback(
  form: Record<string, string>,
): ParsedDemoCallStatus | null {
  const callSid = pick(form, "CallSid");
  const statusRaw = pick(form, "CallStatus");
  if (!callSid || !statusRaw) return null;
  if (!KNOWN_STATUSES.has(statusRaw)) return null;

  return {
    callSid,
    status: statusRaw as VoiceDemoCallStatus,
    durationSeconds: parseDuration(pick(form, "CallDuration")),
    from: pick(form, "From"),
    to: pick(form, "To"),
    recordingUrl: pick(form, "RecordingUrl"),
    errorCode: pick(form, "ErrorCode"),
  };
}

/**
 * Build the `contact_events` row payload for a parsed status update. Pure —
 * the orchestrator does the actual insert. Keeps the metadata shape locked
 * down so future analytics queries can rely on stable JSON keys.
 */
export type DemoCallStatusEventRow = {
  event_type: "voice_demo_call_status";
  source: "voice_ai_demo";
  metadata: {
    twilio_call_sid: string;
    status: VoiceDemoCallStatus;
    duration_seconds: number | null;
    error_code: string | null;
    has_recording: boolean;
  };
};

export function buildStatusEventRow(
  parsed: ParsedDemoCallStatus,
): DemoCallStatusEventRow {
  return {
    event_type: "voice_demo_call_status",
    source: "voice_ai_demo",
    metadata: {
      twilio_call_sid: parsed.callSid,
      status: parsed.status,
      duration_seconds: parsed.durationSeconds,
      error_code: parsed.errorCode,
      has_recording: parsed.recordingUrl !== null,
    },
  };
}
