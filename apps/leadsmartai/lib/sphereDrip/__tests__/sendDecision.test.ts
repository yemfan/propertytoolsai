import { describe, expect, it } from "vitest";

import { BOTH_HIGH_CADENCE } from "@/lib/sphereDrip/cadence";
import {
  decideSendOutcome,
  type ContactSendContext,
} from "@/lib/sphereDrip/sendDecision";

const NOW = "2026-04-27T10:00:00.000Z";
const SMS_STEP = BOTH_HIGH_CADENCE.steps[0]; // step 0 = SMS
const EMAIL_STEP = BOTH_HIGH_CADENCE.steps[1]; // step 1 = email

function contact(overrides: Partial<ContactSendContext> = {}): ContactSendContext {
  return {
    phone: "+15125551234",
    email: "alex@example.com",
    doNotContactSms: false,
    doNotContactEmail: false,
    ...overrides,
  };
}

describe("decideSendOutcome — happy paths", () => {
  it("returns create_draft for an SMS step with phone + no DNC", () => {
    expect(
      decideSendOutcome({ contact: contact(), step: SMS_STEP, nextDueAt: NOW, nowIso: NOW }),
    ).toEqual({ kind: "create_draft" });
  });

  it("returns create_draft for an email step with email + no DNC", () => {
    expect(
      decideSendOutcome({ contact: contact(), step: EMAIL_STEP, nextDueAt: NOW, nowIso: NOW }),
    ).toEqual({ kind: "create_draft" });
  });

  it("treats null nextDueAt as 'send now'", () => {
    expect(
      decideSendOutcome({ contact: contact(), step: SMS_STEP, nextDueAt: null, nowIso: NOW }),
    ).toEqual({ kind: "create_draft" });
  });
});

describe("decideSendOutcome — not yet due", () => {
  it("skips with reason='not_due' when nextDueAt is in the future", () => {
    const future = "2026-04-28T10:00:00.000Z";
    expect(
      decideSendOutcome({ contact: contact(), step: SMS_STEP, nextDueAt: future, nowIso: NOW }),
    ).toEqual({ kind: "skip_no_op", reason: "not_due" });
  });

  it("fires exactly when nextDueAt = nowIso (not strictly greater)", () => {
    expect(
      decideSendOutcome({ contact: contact(), step: SMS_STEP, nextDueAt: NOW, nowIso: NOW }),
    ).toEqual({ kind: "create_draft" });
  });
});

describe("decideSendOutcome — channel-specific DNC", () => {
  it("SMS step + DNC for SMS → skip_advance (let cadence move to next step)", () => {
    expect(
      decideSendOutcome({
        contact: contact({ doNotContactSms: true }),
        step: SMS_STEP,
        nextDueAt: NOW,
        nowIso: NOW,
      }),
    ).toEqual({ kind: "skip_advance", reason: "dnc_channel" });
  });

  it("Email step + DNC for email → skip_advance", () => {
    expect(
      decideSendOutcome({
        contact: contact({ doNotContactEmail: true }),
        step: EMAIL_STEP,
        nextDueAt: NOW,
        nowIso: NOW,
      }),
    ).toEqual({ kind: "skip_advance", reason: "dnc_channel" });
  });

  it("SMS step + DNC for email only → create_draft (different channel, not blocked)", () => {
    expect(
      decideSendOutcome({
        contact: contact({ doNotContactEmail: true }),
        step: SMS_STEP,
        nextDueAt: NOW,
        nowIso: NOW,
      }),
    ).toEqual({ kind: "create_draft" });
  });
});

describe("decideSendOutcome — both channels blocked", () => {
  it("exits the enrollment when SMS + email are both DNC", () => {
    expect(
      decideSendOutcome({
        contact: contact({ doNotContactSms: true, doNotContactEmail: true }),
        step: SMS_STEP,
        nextDueAt: NOW,
        nowIso: NOW,
      }),
    ).toEqual({ kind: "exit", reason: "dnc_all_channels" });
  });

  it("exit takes precedence over not-yet-due (cleans the queue eagerly)", () => {
    const future = "2026-04-28T10:00:00.000Z";
    expect(
      decideSendOutcome({
        contact: contact({ doNotContactSms: true, doNotContactEmail: true }),
        step: SMS_STEP,
        nextDueAt: future,
        nowIso: NOW,
      }),
    ).toEqual({ kind: "skip_no_op", reason: "not_due" });
  });
});

describe("decideSendOutcome — missing channel field", () => {
  it("SMS step + missing phone → skip_advance with reason='missing_field'", () => {
    expect(
      decideSendOutcome({
        contact: contact({ phone: null }),
        step: SMS_STEP,
        nextDueAt: NOW,
        nowIso: NOW,
      }),
    ).toEqual({ kind: "skip_advance", reason: "missing_field" });
  });

  it("SMS step + whitespace-only phone is treated as missing", () => {
    expect(
      decideSendOutcome({
        contact: contact({ phone: "   " }),
        step: SMS_STEP,
        nextDueAt: NOW,
        nowIso: NOW,
      }),
    ).toEqual({ kind: "skip_advance", reason: "missing_field" });
  });

  it("Email step + missing email → skip_advance with reason='missing_field'", () => {
    expect(
      decideSendOutcome({
        contact: contact({ email: null }),
        step: EMAIL_STEP,
        nextDueAt: NOW,
        nowIso: NOW,
      }),
    ).toEqual({ kind: "skip_advance", reason: "missing_field" });
  });
});

describe("decideSendOutcome — no step (cadence complete)", () => {
  it("returns skip_no_op with reason='no_step' when step is null", () => {
    expect(
      decideSendOutcome({
        contact: contact(),
        step: null,
        nextDueAt: NOW,
        nowIso: NOW,
      }),
    ).toEqual({ kind: "skip_no_op", reason: "no_step" });
  });
});
