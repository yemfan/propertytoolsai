/**
 * Per-provider parser interface. Each e-sign provider (Dotloop,
 * DocuSign, HelloSign) has its own webhook payload shape and
 * signature scheme. Providers expose a uniform contract so
 * `/api/webhooks/esign/[provider]` can route to the right one
 * without an `if (provider === ...)` ladder.
 */

import type { SignatureEventType } from "../types";

/** Result of parsing a webhook payload into our internal event shape. */
export type ParsedProviderEvent = {
  /** Provider's id for the envelope this event belongs to.
   *  Looked up against signature_envelopes.provider_id. */
  providerId: string;
  /** Provider's id for THIS specific delivery. Stored in
   *  signature_events.external_event_id for idempotent retries. */
  externalEventId: string | null;
  eventType: SignatureEventType;
  /** Per-signer events carry the signer index; envelope-level
   *  events leave it null. Convention: `0` = first signer in
   *  the envelope's `signers` array. */
  signerIndex: number | null;
  /** When the provider says the event happened (provider clock,
   *  not server). Falls back to "now" upstream when missing. */
  occurredAt: string | null;
};

export type ProviderParser = {
  /** Verify the signature on a webhook request. Returns false
   *  to reject (handler returns 401). Implementations skip when
   *  their secret isn't set, so local dev without provider creds
   *  doesn't error — they just accept all requests. */
  verifySignature(args: {
    rawBody: string;
    headers: Record<string, string>;
  }): boolean;
  /** Parse the JSON-decoded webhook body. Returns null when the
   *  payload is malformed or describes an event type we don't
   *  track — handler 200s + skips so the provider doesn't retry. */
  parseEvent(payload: unknown): ParsedProviderEvent | null;
};
