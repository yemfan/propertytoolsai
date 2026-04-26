/**
 * Pure preflight helpers for the outbound voice-AI demo dispatcher.
 *
 * Lives in its own file (not `outboundCall.ts`) because the dispatcher
 * imports `"server-only"` for its Twilio SDK side effects, which trips up
 * vitest's node environment when these helpers are tested directly.
 *
 * No I/O. No process.env reads. Determined by the caller-supplied args.
 */

export type OutboundCallEnv = {
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_PHONE_NUMBER?: string;
  TWILIO_FROM_NUMBER?: string;
  APP_BASE_URL?: string;
};

export type OutboundCallEnvResolved = {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  appBaseUrl: string;
};

export type OutboundCallEnvCheckFailureCode =
  | "twilio_account_sid_missing"
  | "twilio_auth_token_missing"
  | "twilio_from_missing"
  | "app_base_url_missing";

export type OutboundCallEnvCheckSuccess = { ok: true; env: OutboundCallEnvResolved };
export type OutboundCallEnvCheckFailure = {
  ok: false;
  code: OutboundCallEnvCheckFailureCode;
  reason: string;
};
export type OutboundCallEnvCheck = OutboundCallEnvCheckSuccess | OutboundCallEnvCheckFailure;

/**
 * Type predicate. The codebase has `strict: false` in tsconfig, which
 * keeps narrowing on `if (!result.ok)` from working across the
 * discriminated union — call sites use this predicate to make TS narrow.
 */
export function isOutboundCallEnvFailure(
  r: OutboundCallEnvCheck,
): r is OutboundCallEnvCheckFailure {
  return r.ok === false;
}

/**
 * Pure validator for the env required to place an outbound call. Returns the
 * fully-resolved values on success so the dispatcher doesn't repeat the
 * trim / fallback logic inline.
 *
 * `TWILIO_PHONE_NUMBER` and `TWILIO_FROM_NUMBER` are interchangeable — the
 * codebase has historically used `TWILIO_FROM_NUMBER`; the spec uses
 * `TWILIO_PHONE_NUMBER`. Accept either to match `lib/twilioSms`'s behavior.
 */
export function validateOutboundCallEnv(env: OutboundCallEnv): OutboundCallEnvCheck {
  const accountSid = env.TWILIO_ACCOUNT_SID?.trim() ?? "";
  if (!accountSid) {
    return {
      ok: false,
      code: "twilio_account_sid_missing",
      reason: "TWILIO_ACCOUNT_SID is not set.",
    };
  }
  const authToken = env.TWILIO_AUTH_TOKEN?.trim() ?? "";
  if (!authToken) {
    return {
      ok: false,
      code: "twilio_auth_token_missing",
      reason: "TWILIO_AUTH_TOKEN is not set.",
    };
  }
  const fromNumber =
    env.TWILIO_PHONE_NUMBER?.trim() || env.TWILIO_FROM_NUMBER?.trim() || "";
  if (!fromNumber) {
    return {
      ok: false,
      code: "twilio_from_missing",
      reason: "TWILIO_PHONE_NUMBER (or TWILIO_FROM_NUMBER) is not set.",
    };
  }
  const appBaseUrl = env.APP_BASE_URL?.trim().replace(/\/$/, "") ?? "";
  if (!appBaseUrl) {
    return {
      ok: false,
      code: "app_base_url_missing",
      reason: "APP_BASE_URL is not set — Twilio needs a public TwiML URL.",
    };
  }
  return { ok: true, env: { accountSid, authToken, fromNumber, appBaseUrl } };
}

/**
 * Pure: accepts any plausible US phone shape (raw 10 digits, country-code-
 * prefixed, with separators) and returns E.164 (`+1NXXNXXXXXX`) or null.
 */
export function normalizeTargetPhone(input: string | null | undefined): string | null {
  if (!input || typeof input !== "string") return null;
  const d = input.replace(/\D/g, "");
  const ten = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  if (ten.length !== 10) return null;
  return `+1${ten}`;
}

/**
 * Pure: builds the URL Twilio will POST to when the recipient picks up.
 */
export function buildOutboundDemoTwimlUrl(appBaseUrl: string): string {
  return `${appBaseUrl.replace(/\/$/, "")}/api/twilio/voice/outbound-demo`;
}

/**
 * Pure: builds the URL Twilio will POST to on every call-status transition
 * (initiated → ringing → in-progress → completed / failed / busy / no-answer
 * / canceled). The route at this URL writes one `contact_events` row per
 * transition for the sales-team timeline.
 */
export function buildOutboundDemoStatusUrl(appBaseUrl: string): string {
  return `${appBaseUrl.replace(/\/$/, "")}/api/twilio/voice/outbound-demo/status`;
}
