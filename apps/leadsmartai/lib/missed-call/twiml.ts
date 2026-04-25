/**
 * TwiML builders for the missed-call text-back flow.
 *
 * Inbound flow:
 *   /api/twilio/voice/inbound
 *     ↓ (when missed-call enabled + agent has forwarding_phone)
 *   Returns <Dial> TwiML targeting agent's mobile, with action=
 *     /api/twilio/voice/dial-result
 *     ↓ (when dial ends with no-answer / busy / failed)
 *   Sends SMS to original caller, logs call_logs row.
 *
 * The `<Dial>` `callerId` is set to the inbound call's `From` —
 * this is what carrier-CallerID best practice expects for forwarded
 * calls so the agent's phone shows the actual lead's number, not
 * the Twilio number.
 *
 * Note: setting callerId to a number Twilio doesn't own requires the
 * caller to be a verified caller ID OR for the CNAM/STIR rules to
 * allow it. If your Twilio sub-account doesn't have caller-ID
 * spoofing enabled, fall back to the agent-id mode below by passing
 * `useTwilioCallerId: true`.
 */

export type DialTwimlOpts = {
  forwardingPhoneE164: string;
  /** URL the action callback fires after the dial completes. */
  actionUrl: string;
  /** Twilio dial timeout (ring duration). 5–60s. */
  timeoutSeconds: number;
  /** Set on `<Dial>` callerId to spoof the original caller. */
  inboundCallerE164: string | null;
  /** Use the Twilio number as caller ID instead (safer default). */
  useTwilioCallerId?: boolean;
  /** The Twilio number being called — used when useTwilioCallerId. */
  twilioNumberE164?: string;
};

export function buildDialForwardingTwiml(opts: DialTwimlOpts): string {
  const {
    forwardingPhoneE164,
    actionUrl,
    timeoutSeconds,
    inboundCallerE164,
    useTwilioCallerId,
    twilioNumberE164,
  } = opts;

  // Decide the callerId attribute. We default to the original caller
  // (best UX — the agent sees who's actually calling) but fall back
  // to the Twilio number when explicitly asked.
  const callerId =
    useTwilioCallerId && twilioNumberE164
      ? twilioNumberE164
      : (inboundCallerE164 ?? twilioNumberE164 ?? "");

  const callerIdAttr = callerId ? ` callerId="${escapeXml(callerId)}"` : "";

  // `answerOnBridge` is critical: without it, Twilio answers the
  // inbound leg immediately, which means the caller hears silence
  // while we ring the agent. With it, the caller hears the carrier's
  // ring tone until the agent picks up — much better UX.
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<Response>`,
    `  <Dial timeout="${timeoutSeconds}" answerOnBridge="true" action="${escapeXml(actionUrl)}" method="POST"${callerIdAttr}>`,
    `    <Number>${escapeXml(forwardingPhoneE164)}</Number>`,
    `  </Dial>`,
    `</Response>`,
  ].join("\n");
}

/**
 * After the dial-result webhook fires, we return a tiny TwiML that
 * just hangs up. (Twilio expects a response even though the call is
 * effectively over.)
 */
export function buildDialResultHangupTwiml(): string {
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<Response>`,
    `  <Hangup/>`,
    `</Response>`,
  ].join("\n");
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
