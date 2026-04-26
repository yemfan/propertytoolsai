/**
 * Pure consent + channel-readiness check for SOI equity-update sends.
 *
 * Why this lives in its own file: the send orchestrator does I/O (fetches
 * contact, calls Twilio / email, writes audit), so it's hard to unit-test.
 * The legal/compliance bar is on this gate alone — TCPA for SMS, opt-out
 * respect for email — so we factor it into a pure function and test it
 * exhaustively here.
 *
 * The orchestrator (sendEquityMessage.ts) is responsible for fetching the
 * contact and feeding the row into this checker. Failures from this checker
 * surface to the UI as specific codes so the modal can render a clear,
 * actionable message ("This contact hasn't opted in to SMS — switch to email
 * or send a manual outreach").
 */

export type EquitySendChannel = "sms" | "email";

/**
 * Slim contact shape — exactly the columns the gate reads. Keeping the input
 * narrow lets the orchestrator pass a partial row without coupling the gate
 * to the full Contact type.
 */
export type EquitySendContactView = {
  id: string;
  lifecycleStage: "past_client" | "sphere" | string;
  email: string | null;
  phone: string | null;
  smsOptIn: boolean | null;
  tcpaConsentAt: string | null;
  doNotContactSms: boolean | null;
  doNotContactEmail: boolean | null;
  automationDisabled: boolean | null;
};

export type EquitySendCheckOk = { ok: true };
export type EquitySendCheckFailure = {
  ok: false;
  code:
    | "wrong_lifecycle"
    | "automation_disabled"
    | "no_email"
    | "no_phone"
    | "email_opt_out"
    | "sms_opt_out"
    | "sms_consent_missing"
    | "empty_message";
  reason: string;
};
export type EquitySendCheckResult = EquitySendCheckOk | EquitySendCheckFailure;

/**
 * Type predicate for the failure branch. The codebase has `strict: false`,
 * which keeps narrowing on `if (!r.ok)` from working across the discriminated
 * union — call sites use this predicate to make TS narrow correctly.
 */
export function isEquitySendCheckFailure(
  r: EquitySendCheckResult,
): r is EquitySendCheckFailure {
  return r.ok === false;
}

const SUPPORTED_LIFECYCLES = new Set(["past_client", "sphere"]);

/** Trim and require at least one non-whitespace char. */
function nonEmpty(s: string | null | undefined): boolean {
  return typeof s === "string" && s.trim().length > 0;
}

export function checkEquitySendReadiness(args: {
  contact: EquitySendContactView;
  channel: EquitySendChannel;
  /** SMS body when channel === "sms"; email body when channel === "email". */
  body: string;
  /** Email subject when channel === "email". Ignored for SMS. */
  emailSubject?: string;
}): EquitySendCheckResult {
  const { contact, channel, body, emailSubject } = args;

  // Lifecycle gate — same as the panel's filter. Hard-stop at the helper so
  // a malicious / buggy caller cannot smuggle through a non-sphere contact.
  if (!SUPPORTED_LIFECYCLES.has(contact.lifecycleStage)) {
    return {
      ok: false,
      code: "wrong_lifecycle",
      reason: `Contact lifecycle "${contact.lifecycleStage}" is not eligible for SOI equity outreach.`,
    };
  }

  if (contact.automationDisabled === true) {
    return {
      ok: false,
      code: "automation_disabled",
      reason: "Automation has been turned off for this contact (do_not_disturb).",
    };
  }

  if (!nonEmpty(body)) {
    return { ok: false, code: "empty_message", reason: "Message body is empty." };
  }

  if (channel === "email") {
    if (!nonEmpty(emailSubject)) {
      return { ok: false, code: "empty_message", reason: "Email subject is empty." };
    }
    if (!nonEmpty(contact.email)) {
      return { ok: false, code: "no_email", reason: "Contact has no email on file." };
    }
    if (contact.doNotContactEmail === true) {
      return {
        ok: false,
        code: "email_opt_out",
        reason: "Contact has opted out of email outreach.",
      };
    }
    return { ok: true };
  }

  // SMS — the legally heaviest path. Three independent gates:
  //   1. Phone exists.
  //   2. Not on the do_not_contact_sms suppression list.
  //   3. TCPA consent is on file (sms_opt_in=true AND tcpa_consent_at is set).
  // We require BOTH parts of (3) because an opt-in flag without a timestamp
  // is the legacy/imported pattern that prior schema migrations couldn't
  // reliably backfill — we'd rather refuse to send than gamble on legacy data.
  if (!nonEmpty(contact.phone)) {
    return { ok: false, code: "no_phone", reason: "Contact has no phone on file." };
  }
  if (contact.doNotContactSms === true) {
    return {
      ok: false,
      code: "sms_opt_out",
      reason: "Contact has opted out of SMS outreach.",
    };
  }
  if (contact.smsOptIn !== true || !nonEmpty(contact.tcpaConsentAt)) {
    return {
      ok: false,
      code: "sms_consent_missing",
      reason: "Contact has not given documented TCPA consent for SMS.",
    };
  }

  return { ok: true };
}

/**
 * Human-readable hint matching each failure code. Used by the modal to
 * render an inline message + (where applicable) a fallback CTA.
 */
export function describeSendFailure(code: EquitySendCheckFailure["code"]): {
  title: string;
  hint: string;
} {
  switch (code) {
    case "wrong_lifecycle":
      return {
        title: "Not eligible",
        hint: "This contact isn't a past client or sphere member, so the SOI equity-update flow doesn't apply.",
      };
    case "automation_disabled":
      return {
        title: "Automation off",
        hint: "Automation is disabled for this contact. Re-enable it on their profile to send.",
      };
    case "no_email":
      return {
        title: "No email on file",
        hint: "Add an email to this contact, or send via SMS instead.",
      };
    case "no_phone":
      return {
        title: "No phone on file",
        hint: "Add a phone number to this contact, or send via email instead.",
      };
    case "email_opt_out":
      return {
        title: "Email opt-out",
        hint: "This contact opted out of email. Try SMS, or reach out manually.",
      };
    case "sms_opt_out":
      return {
        title: "SMS opt-out",
        hint: "This contact opted out of SMS. Try email instead.",
      };
    case "sms_consent_missing":
      return {
        title: "TCPA consent missing",
        hint: "We don't have documented consent for SMS to this number. Send via email, or capture consent before texting.",
      };
    case "empty_message":
      return {
        title: "Message is empty",
        hint: "Add some content before sending.",
      };
  }
}
