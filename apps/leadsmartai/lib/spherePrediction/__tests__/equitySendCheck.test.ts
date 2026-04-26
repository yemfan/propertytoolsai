import { describe, expect, it } from "vitest";

import {
  checkEquitySendReadiness,
  describeSendFailure,
  isEquitySendCheckFailure,
  type EquitySendContactView,
} from "@/lib/spherePrediction/equitySendCheck";

function contact(overrides: Partial<EquitySendContactView> = {}): EquitySendContactView {
  return {
    id: "c1",
    lifecycleStage: "past_client",
    email: "sarah@example.com",
    phone: "(555) 123-4567",
    smsOptIn: true,
    tcpaConsentAt: "2024-08-01T00:00:00Z",
    doNotContactSms: false,
    doNotContactEmail: false,
    automationDisabled: false,
    ...overrides,
  };
}

describe("checkEquitySendReadiness — lifecycle gate", () => {
  it("allows past_client", () => {
    const r = checkEquitySendReadiness({ contact: contact(), channel: "sms", body: "hi" });
    expect(r.ok).toBe(true);
  });

  it("allows sphere", () => {
    const r = checkEquitySendReadiness({
      contact: contact({ lifecycleStage: "sphere" }),
      channel: "sms",
      body: "hi",
    });
    expect(r.ok).toBe(true);
  });

  it("rejects active_client / lead / archived (must be past_client or sphere)", () => {
    for (const stage of ["lead", "active_client", "archived", "referral_source"] as const) {
      const r = checkEquitySendReadiness({
        contact: contact({ lifecycleStage: stage }),
        channel: "sms",
        body: "hi",
      });
      expect(r.ok).toBe(false);
      if (isEquitySendCheckFailure(r)) expect(r.code).toBe("wrong_lifecycle");
    }
  });
});

describe("checkEquitySendReadiness — automation_disabled hard-stop", () => {
  it("rejects when automation_disabled=true regardless of channel", () => {
    for (const channel of ["sms", "email"] as const) {
      const r = checkEquitySendReadiness({
        contact: contact({ automationDisabled: true }),
        channel,
        body: "hi",
        emailSubject: "subj",
      });
      expect(r.ok).toBe(false);
      if (isEquitySendCheckFailure(r)) expect(r.code).toBe("automation_disabled");
    }
  });

  it("automation_disabled=null is treated as not-disabled", () => {
    const r = checkEquitySendReadiness({
      contact: contact({ automationDisabled: null }),
      channel: "sms",
      body: "hi",
    });
    expect(r.ok).toBe(true);
  });
});

describe("checkEquitySendReadiness — empty body / subject", () => {
  it("rejects empty body for SMS", () => {
    const r = checkEquitySendReadiness({ contact: contact(), channel: "sms", body: "" });
    expect(r.ok).toBe(false);
    if (isEquitySendCheckFailure(r)) expect(r.code).toBe("empty_message");
  });

  it("rejects whitespace-only body for SMS", () => {
    const r = checkEquitySendReadiness({ contact: contact(), channel: "sms", body: "   " });
    expect(r.ok).toBe(false);
    if (isEquitySendCheckFailure(r)) expect(r.code).toBe("empty_message");
  });

  it("rejects empty subject for email even when body has content", () => {
    const r = checkEquitySendReadiness({
      contact: contact(),
      channel: "email",
      body: "real content",
      emailSubject: "",
    });
    expect(r.ok).toBe(false);
    if (isEquitySendCheckFailure(r)) expect(r.code).toBe("empty_message");
  });

  it("requires subject for email — undefined subject fails", () => {
    const r = checkEquitySendReadiness({
      contact: contact(),
      channel: "email",
      body: "real content",
    });
    expect(r.ok).toBe(false);
    if (isEquitySendCheckFailure(r)) expect(r.code).toBe("empty_message");
  });
});

describe("checkEquitySendReadiness — email channel", () => {
  it("succeeds with email + subject + body", () => {
    const r = checkEquitySendReadiness({
      contact: contact(),
      channel: "email",
      body: "Hi Sarah, market update...",
      emailSubject: "Quick update",
    });
    expect(r.ok).toBe(true);
  });

  it("rejects when contact has no email", () => {
    const r = checkEquitySendReadiness({
      contact: contact({ email: null }),
      channel: "email",
      body: "body",
      emailSubject: "subj",
    });
    expect(r.ok).toBe(false);
    if (isEquitySendCheckFailure(r)) expect(r.code).toBe("no_email");
  });

  it("rejects when do_not_contact_email=true", () => {
    const r = checkEquitySendReadiness({
      contact: contact({ doNotContactEmail: true }),
      channel: "email",
      body: "body",
      emailSubject: "subj",
    });
    expect(r.ok).toBe(false);
    if (isEquitySendCheckFailure(r)) expect(r.code).toBe("email_opt_out");
  });

  it("treats do_not_contact_email=null as not-opted-out", () => {
    const r = checkEquitySendReadiness({
      contact: contact({ doNotContactEmail: null }),
      channel: "email",
      body: "body",
      emailSubject: "subj",
    });
    expect(r.ok).toBe(true);
  });
});

describe("checkEquitySendReadiness — SMS channel (TCPA gate)", () => {
  it("succeeds with phone + sms_opt_in + tcpa_consent_at + not opted-out", () => {
    const r = checkEquitySendReadiness({ contact: contact(), channel: "sms", body: "hi" });
    expect(r.ok).toBe(true);
  });

  it("rejects when contact has no phone", () => {
    const r = checkEquitySendReadiness({
      contact: contact({ phone: null }),
      channel: "sms",
      body: "hi",
    });
    expect(r.ok).toBe(false);
    if (isEquitySendCheckFailure(r)) expect(r.code).toBe("no_phone");
  });

  it("rejects when do_not_contact_sms=true", () => {
    const r = checkEquitySendReadiness({
      contact: contact({ doNotContactSms: true }),
      channel: "sms",
      body: "hi",
    });
    expect(r.ok).toBe(false);
    if (isEquitySendCheckFailure(r)) expect(r.code).toBe("sms_opt_out");
  });

  it("rejects when sms_opt_in=false even if tcpa timestamp exists", () => {
    const r = checkEquitySendReadiness({
      contact: contact({ smsOptIn: false }),
      channel: "sms",
      body: "hi",
    });
    expect(r.ok).toBe(false);
    if (isEquitySendCheckFailure(r)) expect(r.code).toBe("sms_consent_missing");
  });

  it("rejects when tcpa_consent_at is missing even if sms_opt_in=true (legacy data)", () => {
    const r = checkEquitySendReadiness({
      contact: contact({ tcpaConsentAt: null }),
      channel: "sms",
      body: "hi",
    });
    expect(r.ok).toBe(false);
    if (isEquitySendCheckFailure(r)) expect(r.code).toBe("sms_consent_missing");
  });

  it("rejects when sms_opt_in is null (treats null as not-opted-in)", () => {
    const r = checkEquitySendReadiness({
      contact: contact({ smsOptIn: null }),
      channel: "sms",
      body: "hi",
    });
    expect(r.ok).toBe(false);
    if (isEquitySendCheckFailure(r)) expect(r.code).toBe("sms_consent_missing");
  });

  it("opt-out wins over consent — opted-out contact with full consent still rejected", () => {
    const r = checkEquitySendReadiness({
      contact: contact({ doNotContactSms: true }),
      channel: "sms",
      body: "hi",
    });
    expect(r.ok).toBe(false);
    if (isEquitySendCheckFailure(r)) expect(r.code).toBe("sms_opt_out");
  });
});

describe("checkEquitySendReadiness — gate ordering", () => {
  it("lifecycle is checked before automation_disabled", () => {
    const r = checkEquitySendReadiness({
      contact: contact({ lifecycleStage: "lead", automationDisabled: true }),
      channel: "sms",
      body: "hi",
    });
    expect(r.ok).toBe(false);
    if (isEquitySendCheckFailure(r)) expect(r.code).toBe("wrong_lifecycle");
  });

  it("automation_disabled is checked before consent", () => {
    const r = checkEquitySendReadiness({
      contact: contact({ automationDisabled: true, smsOptIn: false }),
      channel: "sms",
      body: "hi",
    });
    expect(r.ok).toBe(false);
    if (isEquitySendCheckFailure(r)) expect(r.code).toBe("automation_disabled");
  });

  it("opt-out is checked before consent (opt-out is a stronger signal than consent missing)", () => {
    const r = checkEquitySendReadiness({
      contact: contact({ doNotContactSms: true, smsOptIn: false, tcpaConsentAt: null }),
      channel: "sms",
      body: "hi",
    });
    expect(r.ok).toBe(false);
    if (isEquitySendCheckFailure(r)) expect(r.code).toBe("sms_opt_out");
  });
});

describe("describeSendFailure", () => {
  it("returns a title + hint for every failure code", () => {
    const codes = [
      "wrong_lifecycle",
      "automation_disabled",
      "no_email",
      "no_phone",
      "email_opt_out",
      "sms_opt_out",
      "sms_consent_missing",
      "empty_message",
    ] as const;
    for (const code of codes) {
      const out = describeSendFailure(code);
      expect(out.title.length).toBeGreaterThan(0);
      expect(out.hint.length).toBeGreaterThan(0);
    }
  });

  it("TCPA hint references documented consent (regulatory wording)", () => {
    const out = describeSendFailure("sms_consent_missing");
    expect(out.hint).toMatch(/consent/i);
  });
});
