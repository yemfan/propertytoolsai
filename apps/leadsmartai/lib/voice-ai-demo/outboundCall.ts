import "server-only";

import twilio from "twilio";

import {
  buildOutboundDemoTwimlUrl,
  isOutboundCallEnvFailure,
  normalizeTargetPhone,
  validateOutboundCallEnv,
  type OutboundCallEnvCheckFailureCode,
} from "@/lib/voice-ai-demo/preflight";

/**
 * Outbound voice-AI demo call dispatcher. Triggered by the marketing
 * demo-request endpoint when the agent prospect picks "have it call me".
 *
 * Pure preflight helpers (env validation, phone normalization, TwiML URL
 * construction) live in `preflight.ts` so they're testable without the
 * `server-only` shim. This file is the impure orchestrator that talks
 * to Twilio.
 */

// Re-export pure helpers so existing call sites can import from a single module.
export {
  buildOutboundDemoTwimlUrl,
  isOutboundCallEnvFailure,
  normalizeTargetPhone,
  validateOutboundCallEnv,
} from "@/lib/voice-ai-demo/preflight";
export type {
  OutboundCallEnv,
  OutboundCallEnvCheck,
  OutboundCallEnvCheckFailure,
  OutboundCallEnvCheckFailureCode,
  OutboundCallEnvCheckSuccess,
  OutboundCallEnvResolved,
} from "@/lib/voice-ai-demo/preflight";

export type DispatchOutboundDemoCallArgs = {
  /** Where to call. Any US phone shape; will be normalized to E.164. */
  toPhone: string;
  /**
   * Lead row id — for downstream call-completion correlation. Optional;
   * call still goes out without it.
   */
  leadId?: string | null;
};

export type DispatchOutboundDemoCallSuccess = {
  ok: true;
  callSid: string;
  toE164: string;
};

export type DispatchOutboundDemoCallFailure = {
  ok: false;
  code: OutboundCallEnvCheckFailureCode | "phone_invalid" | "twilio_call_failed";
  reason: string;
};

export type DispatchOutboundDemoCallResult =
  | DispatchOutboundDemoCallSuccess
  | DispatchOutboundDemoCallFailure;

export function isDispatchOutboundDemoCallFailure(
  r: DispatchOutboundDemoCallResult,
): r is DispatchOutboundDemoCallFailure {
  return r.ok === false;
}

/**
 * Place the outbound demo call. Returns a structured result — never throws
 * for predictable failure modes (missing env, bad phone, Twilio rejection).
 */
export async function dispatchOutboundDemoCall(
  args: DispatchOutboundDemoCallArgs,
): Promise<DispatchOutboundDemoCallResult> {
  const envCheck = validateOutboundCallEnv({
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
    TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER,
    APP_BASE_URL: process.env.APP_BASE_URL,
  });
  if (isOutboundCallEnvFailure(envCheck)) {
    return { ok: false, code: envCheck.code, reason: envCheck.reason };
  }

  const toE164 = normalizeTargetPhone(args.toPhone);
  if (!toE164) {
    return {
      ok: false,
      code: "phone_invalid",
      reason: "Target phone is not a valid 10-digit US number.",
    };
  }

  const url = buildOutboundDemoTwimlUrl(envCheck.env.appBaseUrl);
  const client = twilio(envCheck.env.accountSid, envCheck.env.authToken);

  try {
    const call = await client.calls.create({
      from: envCheck.env.fromNumber,
      to: toE164,
      url,
      method: "POST",
    });
    return { ok: true, callSid: String(call.sid), toE164 };
  } catch (e) {
    const reason = e instanceof Error ? e.message : "twilio_call_create_failed";
    return { ok: false, code: "twilio_call_failed", reason };
  }
}
