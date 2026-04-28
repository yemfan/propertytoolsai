/**
 * Pure helpers for the call-tracking number system.
 *
 * The inbound voice/SMS handlers receive Twilio's `To` parameter
 * (the dialed number). We map that back to a tracking_numbers row
 * to learn the source. Lives without `server-only` so vitest hits
 * it directly; the async fetcher lives in `lookup.server.ts`.
 *
 * E.164 normalization is intentionally permissive — Twilio always
 * sends E.164 in the `To` field, but we trim whitespace and add a
 * leading `+` if the raw input forgot one (some webhook flows
 * lowercase / strip prefixes).
 */

export type TrackingNumberRow = {
  id: string;
  agentId: string;
  phoneE164: string;
  sourceLabel: string;
  forwardToPhone: string | null;
  isActive: boolean;
};

/**
 * Find the tracking number that matches the dialed `To` phone.
 * Returns null when no row matches OR the matching row is paused.
 *
 * Pure — caller fetches the candidate set from DB and feeds it in.
 */
export function findTrackingNumber(
  toPhoneRaw: string | null | undefined,
  candidates: ReadonlyArray<TrackingNumberRow>,
): TrackingNumberRow | null {
  const normalized = normalizeE164(toPhoneRaw);
  if (!normalized) return null;
  for (const row of candidates) {
    if (row.phoneE164 === normalized && row.isActive) {
      return row;
    }
  }
  return null;
}

/**
 * Normalize a phone string for tracking-number comparison. Less
 * permissive than the click-to-call helper because Twilio webhook
 * input is well-defined — we just need to handle whitespace +
 * the rare missing-`+`-prefix case.
 */
export function normalizeE164(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = String(input).trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D+/g, "");
    if (digits.length < 7 || digits.length > 15) return null;
    return `+${digits}`;
  }

  // Bare digits — typically Twilio sends "+1..." but a misconfigured
  // proxy might strip the +. Add it back when the result looks
  // E.164-ish (7-15 digits).
  const digits = trimmed.replace(/\D+/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return `+${digits}`;
}

/**
 * Decide where to forward a call that came in on a tracking number.
 * Order:
 *   1. The tracking number's own forward_to_phone, when set
 *   2. The agent's primary phone (caller passes it in)
 *   3. null — caller decides whether to drop or play voicemail
 */
export function resolveForwardTarget(args: {
  trackingNumber: TrackingNumberRow;
  agentPrimaryPhone: string | null;
}): string | null {
  return (
    normalizeE164(args.trackingNumber.forwardToPhone) ??
    normalizeE164(args.agentPrimaryPhone) ??
    null
  );
}
