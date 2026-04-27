/**
 * Pure helpers for the contact-profile voice-call timeline.
 *
 * Twilio's status-callback handler (added in #154) writes one
 * `contact_events` row per call-state transition (initiated → ringing →
 * in-progress → completed / failed / busy / no-answer / canceled). The
 * sales-team-facing timeline doesn't want to render four separate rows
 * per call — it wants ONE entry per call summarizing the outcome:
 *
 *   "AI called Sarah at 14:02:11 — completed, 4m32s"
 *   "AI called Mike at 09:15:08 — no-answer"
 *
 * `groupByCall` consumes the per-status event rows and emits one
 * `VoiceCallEntry` per `twilio_call_sid`. Pure — no I/O.
 */

export type VoiceCallStatus =
  | "queued"
  | "initiated"
  | "ringing"
  | "in-progress"
  | "completed"
  | "busy"
  | "no-answer"
  | "failed"
  | "canceled";

/**
 * Final / terminal statuses for a Twilio call. The timeline shows the
 * latest terminal status if one exists, otherwise the latest in-flight
 * status (calls still in progress when the page loads).
 */
const TERMINAL_STATUSES: ReadonlySet<VoiceCallStatus> = new Set([
  "completed",
  "busy",
  "no-answer",
  "failed",
  "canceled",
]);

/** Shape of a row from `contact_events` after the route projects it. */
export type VoiceCallEventRow = {
  createdAt: string;
  metadata: {
    twilio_call_sid?: string;
    status?: string;
    duration_seconds?: number | null;
    error_code?: string | null;
    has_recording?: boolean;
  } | null;
};

export type VoiceCallEntry = {
  callSid: string;
  /** ISO timestamp of the FIRST event we saw for this call (the call's start). */
  startedAt: string;
  /** Final or latest-in-flight status. */
  status: VoiceCallStatus;
  /** Duration in seconds for completed calls. Null otherwise. */
  durationSeconds: number | null;
  /** Twilio error code on failure (e.g. "13225"). Null on success. */
  errorCode: string | null;
  /** Whether the call had recording enabled. Currently always false until we wire it. */
  hasRecording: boolean;
  /** Total number of status events written for this call (for "X transitions" tooltip). */
  transitionCount: number;
};

function isVoiceCallStatus(s: unknown): s is VoiceCallStatus {
  return (
    typeof s === "string" &&
    [
      "queued",
      "initiated",
      "ringing",
      "in-progress",
      "completed",
      "busy",
      "no-answer",
      "failed",
      "canceled",
    ].includes(s)
  );
}

/**
 * Group raw status-event rows into per-call entries.
 *
 * The "winning" status for a call is selected as follows:
 *   1. Latest TERMINAL status (completed / busy / no-answer / failed / canceled)
 *   2. If no terminal exists, latest in-flight status (queued / initiated / ringing / in-progress)
 *
 * This keeps the UI honest when Twilio hasn't fired the terminal callback
 * yet (call still in progress) — the timeline shows "ringing" or
 * "in-progress" rather than misreporting "completed."
 *
 * Sort: results in `startedAt` desc — most-recent call first.
 */
export function groupByCall(
  rows: ReadonlyArray<VoiceCallEventRow>,
): VoiceCallEntry[] {
  type Accum = {
    callSid: string;
    earliestAt: string;
    transitionCount: number;
    latestTerminalStatus: VoiceCallStatus | null;
    latestTerminalAt: string | null;
    latestInFlightStatus: VoiceCallStatus | null;
    latestInFlightAt: string | null;
    durationSeconds: number | null;
    errorCode: string | null;
    hasRecording: boolean;
  };

  const byCall = new Map<string, Accum>();

  for (const row of rows) {
    const sid =
      row.metadata && typeof row.metadata.twilio_call_sid === "string"
        ? row.metadata.twilio_call_sid
        : null;
    if (!sid) continue;
    const status = row.metadata?.status;
    if (!isVoiceCallStatus(status)) continue;

    const existing =
      byCall.get(sid) ??
      ({
        callSid: sid,
        earliestAt: row.createdAt,
        transitionCount: 0,
        latestTerminalStatus: null,
        latestTerminalAt: null,
        latestInFlightStatus: null,
        latestInFlightAt: null,
        durationSeconds: null,
        errorCode: null,
        hasRecording: false,
      } satisfies Accum);

    existing.transitionCount += 1;

    // Earliest start: keep the smallest createdAt seen.
    if (row.createdAt < existing.earliestAt) {
      existing.earliestAt = row.createdAt;
    }

    if (TERMINAL_STATUSES.has(status)) {
      if (!existing.latestTerminalAt || row.createdAt > existing.latestTerminalAt) {
        existing.latestTerminalStatus = status;
        existing.latestTerminalAt = row.createdAt;
      }
    } else if (
      !existing.latestInFlightAt ||
      row.createdAt > existing.latestInFlightAt
    ) {
      existing.latestInFlightStatus = status;
      existing.latestInFlightAt = row.createdAt;
    }

    // Per-event metadata: keep the most recent non-null seen.
    if (
      row.metadata?.duration_seconds != null &&
      Number.isFinite(row.metadata.duration_seconds)
    ) {
      existing.durationSeconds = row.metadata.duration_seconds;
    }
    if (typeof row.metadata?.error_code === "string" && row.metadata.error_code) {
      existing.errorCode = row.metadata.error_code;
    }
    if (row.metadata?.has_recording === true) {
      existing.hasRecording = true;
    }

    byCall.set(sid, existing);
  }

  const entries: VoiceCallEntry[] = Array.from(byCall.values()).map((a) => ({
    callSid: a.callSid,
    startedAt: a.earliestAt,
    status: a.latestTerminalStatus ?? a.latestInFlightStatus ?? "queued",
    durationSeconds: a.durationSeconds,
    errorCode: a.errorCode,
    hasRecording: a.hasRecording,
    transitionCount: a.transitionCount,
  }));

  // Sort by start time descending — most-recent call first.
  entries.sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0));
  return entries;
}

/**
 * Format duration seconds as a human-readable string. Examples:
 *   null     → "—"
 *   0        → "0s"
 *   45       → "45s"
 *   272      → "4m 32s"
 *   3705     → "1h 1m"
 */
export function formatDuration(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const mins = Math.floor(s / 60);
  const remS = s % 60;
  if (mins < 60) return `${mins}m ${remS}s`;
  const hours = Math.floor(mins / 60);
  const remM = mins % 60;
  return `${hours}h ${remM}m`;
}

/**
 * Map a status to a human label + a tone color name. The panel uses the
 * tone to pick a CSS class — keeps the mapping in one place so a future
 * add (e.g. "voicemail" status) lands consistently.
 */
export type StatusTone = "success" | "in-flight" | "failed" | "neutral";

export function describeStatus(status: VoiceCallStatus): {
  label: string;
  tone: StatusTone;
} {
  switch (status) {
    case "completed":
      return { label: "Completed", tone: "success" };
    case "in-progress":
      return { label: "In progress", tone: "in-flight" };
    case "ringing":
      return { label: "Ringing", tone: "in-flight" };
    case "queued":
      return { label: "Queued", tone: "in-flight" };
    case "initiated":
      return { label: "Initiated", tone: "in-flight" };
    case "busy":
      return { label: "Busy", tone: "failed" };
    case "no-answer":
      return { label: "No answer", tone: "failed" };
    case "failed":
      return { label: "Failed", tone: "failed" };
    case "canceled":
      return { label: "Canceled", tone: "neutral" };
  }
}
