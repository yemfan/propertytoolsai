import { describe, expect, it } from "vitest";

import {
  formatVoiceDemoPhoneDisplay,
  formatVoiceDemoPhoneTelHref,
  resolveVoiceDemoPhone,
} from "@/lib/marketing/voiceDemoPhone";

describe("formatVoiceDemoPhoneDisplay", () => {
  it("returns null for null/undefined/empty", () => {
    expect(formatVoiceDemoPhoneDisplay(null)).toBeNull();
    expect(formatVoiceDemoPhoneDisplay(undefined)).toBeNull();
    expect(formatVoiceDemoPhoneDisplay("")).toBeNull();
  });

  it("formats a bare 10-digit number", () => {
    expect(formatVoiceDemoPhoneDisplay("4155550123")).toBe("(415) 555-0123");
  });

  it("strips a leading +1 country code", () => {
    expect(formatVoiceDemoPhoneDisplay("+14155550123")).toBe("(415) 555-0123");
  });

  it("strips a leading 1 (no plus)", () => {
    expect(formatVoiceDemoPhoneDisplay("14155550123")).toBe("(415) 555-0123");
  });

  it("normalizes punctuation variants", () => {
    expect(formatVoiceDemoPhoneDisplay("(415) 555-0123")).toBe("(415) 555-0123");
    expect(formatVoiceDemoPhoneDisplay("415.555.0123")).toBe("(415) 555-0123");
    expect(formatVoiceDemoPhoneDisplay("415 555 0123")).toBe("(415) 555-0123");
  });

  it("returns null for short numbers", () => {
    expect(formatVoiceDemoPhoneDisplay("4155550")).toBeNull();
  });

  it("returns null for too-long numbers (12+ digits)", () => {
    expect(formatVoiceDemoPhoneDisplay("12345678901234")).toBeNull();
  });

  it("returns null for non-string input that slipped through", () => {
    // intentional cast — guarding against runtime mishaps
    expect(formatVoiceDemoPhoneDisplay(415_555_0123 as unknown as string)).toBeNull();
  });
});

describe("formatVoiceDemoPhoneTelHref", () => {
  it("returns null for invalid input", () => {
    expect(formatVoiceDemoPhoneTelHref(null)).toBeNull();
    expect(formatVoiceDemoPhoneTelHref("123")).toBeNull();
  });

  it("emits E.164 with +1 country code", () => {
    expect(formatVoiceDemoPhoneTelHref("4155550123")).toBe("tel:+14155550123");
    expect(formatVoiceDemoPhoneTelHref("(415) 555-0123")).toBe("tel:+14155550123");
    expect(formatVoiceDemoPhoneTelHref("+1 415-555-0123")).toBe("tel:+14155550123");
  });

  it("does not double the country code when one is already present", () => {
    expect(formatVoiceDemoPhoneTelHref("+14155550123")).toBe("tel:+14155550123");
  });
});

describe("resolveVoiceDemoPhone", () => {
  it("returns both display and tel for a valid number", () => {
    expect(resolveVoiceDemoPhone("4155550123")).toEqual({
      display: "(415) 555-0123",
      telHref: "tel:+14155550123",
    });
  });

  it("returns null on both fields for invalid input", () => {
    expect(resolveVoiceDemoPhone(null)).toEqual({ display: null, telHref: null });
    expect(resolveVoiceDemoPhone("")).toEqual({ display: null, telHref: null });
    expect(resolveVoiceDemoPhone("not-a-number")).toEqual({ display: null, telHref: null });
  });
});
