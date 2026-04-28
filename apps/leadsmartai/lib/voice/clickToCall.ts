/**
 * Pure helpers for outbound click-to-call (Twilio).
 *
 * Architecture: phone-to-phone bridge.
 *   1. Agent clicks "Call now" on a contact in the CRM
 *   2. Server creates a Twilio call: dial agent's phone first
 *   3. When agent picks up, Twilio fetches our bridge TwiML
 *      which `<Dial>`s the contact's number, joining them
 *   4. Status webhooks update lead_calls
 *
 * No browser softphone required for MVP — agents use their own
 * phone (cell, desk, whatever). Callee sees the agent's Twilio
 * caller ID. This is the same pattern Follow Up Boss uses.
 *
 * This file holds the pure logic (phone normalization, TwiML
 * generation, validation). The server-side Twilio API call lives
 * in clickToCall.server.ts so vitest can hit the math without
 * spinning up Twilio.
 */

export class ClickToCallError extends Error {
  readonly code:
    | "missing_agent_phone"
    | "missing_contact_phone"
    | "invalid_phone"
    | "twilio_not_configured"
    | "twilio_api_failed"
    | "missing_caller_id";
  constructor(code: ClickToCallError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Normalize a phone string to E.164. Accepts:
 *   - "+1 (555) 123-4567"  → "+15551234567"
 *   - "555-123-4567"       → "+15551234567" (US default)
 *   - "+44 20 1234 5678"   → "+442012345678"
 *
 * Defaults to +1 (US) when the input has no country code AND ends
 * up at 10 digits. Returns null on anything that doesn't parse.
 */
export function normalizeE164(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = String(input).trim();
  if (!trimmed) return null;

  // Strip everything except digits + leading +.
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D+/g, "");
  if (digits.length === 0) return null;

  if (hasPlus) {
    // Already international. Validate 7-15 digit length per E.164.
    if (digits.length < 7 || digits.length > 15) return null;
    return `+${digits}`;
  }

  // No leading +. If 10 digits, assume US. If 11 starting with 1, assume US.
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;

  // Anything else with no country code is ambiguous — refuse rather than guess.
  return null;
}

/**
 * Decide whether a click-to-call attempt is valid before hitting
 * Twilio. Returns either the normalized pair or a structured error
 * code. Lets the server route fail fast with a useful message.
 */
export type ClickToCallInput = {
  agentPhoneRaw: string | null;
  contactPhoneRaw: string | null;
  callerId: string | null;
};

export type NormalizedClickToCall = {
  agentPhone: string;
  contactPhone: string;
  callerId: string;
};

export function validateClickToCallInput(
  input: ClickToCallInput,
): NormalizedClickToCall {
  const agentPhone = normalizeE164(input.agentPhoneRaw);
  if (!agentPhone) {
    throw new ClickToCallError(
      input.agentPhoneRaw ? "invalid_phone" : "missing_agent_phone",
      input.agentPhoneRaw
        ? "Agent phone number isn't a valid E.164 number."
        : "Add your phone number under Settings before placing calls.",
    );
  }
  const contactPhone = normalizeE164(input.contactPhoneRaw);
  if (!contactPhone) {
    throw new ClickToCallError(
      input.contactPhoneRaw ? "invalid_phone" : "missing_contact_phone",
      input.contactPhoneRaw
        ? "Contact phone number isn't a valid E.164 number."
        : "This contact has no phone number on file.",
    );
  }
  const callerId = normalizeE164(input.callerId);
  if (!callerId) {
    throw new ClickToCallError(
      "missing_caller_id",
      "Twilio caller ID is not configured (TWILIO_PHONE_NUMBER).",
    );
  }
  return { agentPhone, contactPhone, callerId };
}

/**
 * Build the bridge TwiML the agent's leg fetches once they pick up.
 * Plays a short whisper announcing the contact, then dials the
 * contact's number. The whisper gives the agent context — they
 * dialed lots of leads today, and a brief "Calling Jane Smith now"
 * before the bridge prevents "wait, who is this?" confusion.
 *
 * `callerId` is the Twilio number that shows on the contact's
 * caller ID. The agent's own number is NOT exposed.
 */
export function buildBridgeTwiml(args: {
  contactPhone: string;
  callerId: string;
  /** Optional whisper text — typically the contact's name. */
  whisper?: string | null;
  /** Optional status callback URL Twilio hits when the dialed leg ends. */
  statusCallbackUrl?: string | null;
}): string {
  const whisper = args.whisper?.trim();
  const escape = escapeXml;
  const parts: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Response>",
  ];
  if (whisper) {
    parts.push(`  <Say voice="Polly.Joanna">${escape(whisper)}</Say>`);
  }
  const dialAttrs = [`callerId="${escape(args.callerId)}"`];
  if (args.statusCallbackUrl) {
    dialAttrs.push(`action="${escape(args.statusCallbackUrl)}"`);
    dialAttrs.push('method="POST"');
  }
  parts.push(`  <Dial ${dialAttrs.join(" ")}>${escape(args.contactPhone)}</Dial>`);
  parts.push("</Response>");
  return parts.join("\n");
}

function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
