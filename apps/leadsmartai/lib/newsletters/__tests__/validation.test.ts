import { describe, expect, it } from "vitest";
import { validateDraft, validateForSend } from "../validation";

describe("validateDraft", () => {
  it("accepts a valid draft", () => {
    expect(
      validateDraft({
        subject: "Spring market update",
        bodyHtml: "<p>Hi {{firstName}}</p>",
        bodyText: "Hi {{firstName}}",
      }),
    ).toEqual({ ok: true, issues: [] });
  });

  it("flags missing subject", () => {
    const r = validateDraft({
      subject: "",
      bodyHtml: "<p>x</p>",
      bodyText: "x",
    });
    expect(r.issues).toContain("missing_subject");
  });

  it("flags subject that's whitespace-only", () => {
    const r = validateDraft({
      subject: "   ",
      bodyHtml: "<p>x</p>",
      bodyText: "x",
    });
    expect(r.issues).toContain("missing_subject");
  });

  it("flags subject that exceeds 200 chars", () => {
    const r = validateDraft({
      subject: "x".repeat(201),
      bodyHtml: "<p>x</p>",
      bodyText: "x",
    });
    expect(r.issues).toContain("subject_too_long");
  });

  it("accepts when only the HTML body is present", () => {
    const r = validateDraft({
      subject: "Hi",
      bodyHtml: "<p>x</p>",
      bodyText: "",
    });
    expect(r.ok).toBe(true);
  });

  it("accepts when only the text body is present", () => {
    const r = validateDraft({
      subject: "Hi",
      bodyHtml: "",
      bodyText: "x",
    });
    expect(r.ok).toBe(true);
  });

  it("flags missing body when both are empty", () => {
    const r = validateDraft({ subject: "Hi", bodyHtml: "", bodyText: "" });
    expect(r.issues).toContain("missing_body");
  });
});

describe("validateForSend", () => {
  function valid(overrides: Partial<Parameters<typeof validateForSend>[0]> = {}) {
    return {
      subject: "Spring market update",
      bodyHtml: "<p>Hi {{firstName}}</p><p>Unsubscribe: {{unsubscribeUrl}}</p>",
      bodyText: "Hi {{firstName}}\nUnsubscribe: {{unsubscribeUrl}}",
      recipientCount: 5,
      ...overrides,
    };
  }

  it("accepts a fully valid send", () => {
    expect(validateForSend(valid())).toEqual({ ok: true, issues: [] });
  });

  it("flags zero recipients", () => {
    const r = validateForSend(valid({ recipientCount: 0 }));
    expect(r.issues).toContain("no_recipients");
  });

  it("flags missing unsubscribe link (CAN-SPAM)", () => {
    const r = validateForSend(
      valid({
        bodyHtml: "<p>Hi {{firstName}}</p>",
        bodyText: "Hi {{firstName}}",
      }),
    );
    expect(r.issues).toContain("missing_unsubscribe_link");
  });

  it("accepts when the unsubscribe word appears (no token needed)", () => {
    const r = validateForSend(
      valid({
        bodyHtml: '<p>Hi {{firstName}}</p><a href="...">Unsubscribe</a>',
        bodyText: "Hi {{firstName}}\nTo unsubscribe, reply STOP.",
      }),
    );
    expect(r.ok).toBe(true);
  });

  it("flags unknown tokens with names listed", () => {
    const r = validateForSend(
      valid({
        bodyHtml: "<p>Hi {{firstName}}, call {{phoneNumber}} {{unsubscribeUrl}}</p>",
        bodyText: "Hi {{firstName}}, call {{phoneNumber}} {{unsubscribeUrl}}",
      }),
    );
    expect(r.issues).toContain("unknown_tokens");
    expect(r.unknownTokenNames).toContain("phoneNumber");
  });

  it("does not flag tokens listed in allowedExtraTokens", () => {
    const r = validateForSend({
      ...valid({
        bodyHtml: "<p>Hi {{firstName}}, your address {{propertyAddress}} {{unsubscribeUrl}}</p>",
        bodyText: "Hi {{firstName}} {{unsubscribeUrl}}",
      }),
      allowedExtraTokens: ["propertyAddress"],
    });
    expect(r.ok).toBe(true);
  });

  it("treats {{firstname}} (lowercase) as the same token as {{firstName}}", () => {
    const r = validateForSend(
      valid({
        bodyHtml: "<p>Hi {{firstname}} {{unsubscribeUrl}}</p>",
        bodyText: "Hi {{firstname}} {{unsubscribeUrl}}",
      }),
    );
    expect(r.ok).toBe(true);
    expect(r.unknownTokenNames).toBeUndefined();
  });
});
