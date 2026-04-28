/**
 * Map provider-specific webhook event names + envelope statuses to
 * the canonical `EnvelopeStatus` / `SignatureEventType` enums.
 *
 * Pure module — vitest hits each provider table directly without
 * external SDKs.
 */

import type { EnvelopeStatus, ESignProvider, SignatureEventType } from "./types";

/**
 * Provider event name → canonical event type. Returns null when the
 * provider's event isn't worth recording (e.g. metadata-only pings).
 */
const EVENT_TABLES: Record<ESignProvider, Record<string, SignatureEventType>> = {
  dotloop: {
    "loop.sent": "sent",
    "loop.viewed": "viewed",
    "document.viewed": "viewed",
    "document.signed": "signed",
    "loop.signed": "signed",
    "loop.completed": "completed",
    "loop.declined": "declined",
    "loop.voided": "voided",
    "loop.expired": "expired",
    "loop.reminder.sent": "reminded",
  },
  docusign: {
    // DocuSign webhook event names (Connect)
    "envelope-sent": "sent",
    "envelope-resent": "reminded",
    "envelope-delivered": "viewed",
    "recipient-viewed": "viewed",
    "recipient-completed": "signed",
    "envelope-completed": "completed",
    "envelope-declined": "declined",
    "envelope-voided": "voided",
    "envelope-expired": "expired",
  },
  hellosign: {
    "signature_request_sent": "sent",
    "signature_request_viewed": "viewed",
    "signature_request_signed": "signed",
    "signature_request_all_signed": "completed",
    "signature_request_declined": "declined",
    "signature_request_canceled": "voided",
    "signature_request_remind": "reminded",
  },
};

export function mapProviderEventType(
  provider: ESignProvider,
  rawEventName: string,
): SignatureEventType | null {
  const table = EVENT_TABLES[provider];
  if (!table) return null;
  // Case-insensitive lookup so providers that ship "Envelope-Sent"
  // and "envelope-sent" interchangeably both work.
  const key = rawEventName.toLowerCase().trim();
  for (const [k, v] of Object.entries(table)) {
    if (k.toLowerCase() === key) return v;
  }
  return null;
}

/**
 * Compute the envelope-level status implied by a recent event. The
 * webhook handler calls this when it has just inserted a signature_event,
 * to decide whether the envelope row's `status` should advance.
 *
 * Rules:
 *   - 'completed' / 'declined' / 'voided' / 'expired' → terminal,
 *     overwrite envelope status
 *   - 'signed' (per-signer) → envelope stays where it is unless the
 *     caller has already determined all signers are signed (then
 *     pass `allSigned=true` and we promote to 'completed')
 *   - 'viewed' → advance to 'viewed' if envelope was 'sent', else
 *     no change (don't regress 'signed' back to 'viewed')
 *   - 'sent' / 'reminded' → no change to envelope status
 */
export function nextEnvelopeStatus(args: {
  current: EnvelopeStatus;
  event: SignatureEventType;
  /** Set by the caller: did this event complete the envelope? */
  allSigned?: boolean;
}): EnvelopeStatus {
  const { current, event, allSigned } = args;
  if (event === "completed") return "completed";
  if (event === "declined") return "declined";
  if (event === "voided") return "voided";
  if (event === "expired") return "expired";
  if (event === "signed") {
    return allSigned ? "completed" : (current === "sent" || current === "viewed" ? "signed" : current);
  }
  if (event === "viewed") {
    if (current === "sent") return "viewed";
    return current;
  }
  // 'sent' (an event AFTER the envelope was already sent) and
  // 'reminded' — no envelope-level change.
  return current;
}
