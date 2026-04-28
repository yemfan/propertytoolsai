import { describe, expect, it } from "vitest";
import {
  buildBridgeTwiml,
  ClickToCallError,
  normalizeE164,
  validateClickToCallInput,
} from "../clickToCall";

describe("normalizeE164", () => {
  it("returns null for null/empty input", () => {
    expect(normalizeE164(null)).toBeNull();
    expect(normalizeE164(undefined)).toBeNull();
    expect(normalizeE164("")).toBeNull();
    expect(normalizeE164("   ")).toBeNull();
  });

  it("strips formatting from a US number and adds +1", () => {
    expect(normalizeE164("(555) 123-4567")).toBe("+15551234567");
    expect(normalizeE164("555-123-4567")).toBe("+15551234567");
    expect(normalizeE164("555.123.4567")).toBe("+15551234567");
  });

  it("preserves an existing + prefix", () => {
    expect(normalizeE164("+15551234567")).toBe("+15551234567");
    expect(normalizeE164("+1 (555) 123-4567")).toBe("+15551234567");
    expect(normalizeE164("+44 20 1234 5678")).toBe("+442012345678");
  });

  it("treats an 11-digit number starting with 1 as US", () => {
    expect(normalizeE164("15551234567")).toBe("+15551234567");
    expect(normalizeE164("1-555-123-4567")).toBe("+15551234567");
  });

  it("refuses ambiguous inputs (no plus, not 10/11 digits)", () => {
    expect(normalizeE164("123")).toBeNull();
    expect(normalizeE164("442012345678")).toBeNull(); // 12 digits, no +
  });

  it("refuses E.164 numbers outside the 7–15 digit range", () => {
    expect(normalizeE164("+1234")).toBeNull();
    expect(normalizeE164("+1234567890123456")).toBeNull();
  });
});

describe("validateClickToCallInput", () => {
  it("returns the normalized triple on happy path", () => {
    const out = validateClickToCallInput({
      agentPhoneRaw: "(415) 555-0001",
      contactPhoneRaw: "415-555-0002",
      callerId: "+14155550003",
    });
    expect(out).toEqual({
      agentPhone: "+14155550001",
      contactPhone: "+14155550002",
      callerId: "+14155550003",
    });
  });

  it("throws missing_agent_phone when agent phone is null", () => {
    try {
      validateClickToCallInput({
        agentPhoneRaw: null,
        contactPhoneRaw: "+14155550002",
        callerId: "+14155550003",
      });
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ClickToCallError);
      expect((e as ClickToCallError).code).toBe("missing_agent_phone");
    }
  });

  it("throws invalid_phone when agent phone is malformed", () => {
    try {
      validateClickToCallInput({
        agentPhoneRaw: "not-a-phone",
        contactPhoneRaw: "+14155550002",
        callerId: "+14155550003",
      });
      expect.fail("should have thrown");
    } catch (e) {
      expect((e as ClickToCallError).code).toBe("invalid_phone");
    }
  });

  it("throws missing_contact_phone when contact phone is null", () => {
    try {
      validateClickToCallInput({
        agentPhoneRaw: "+14155550001",
        contactPhoneRaw: null,
        callerId: "+14155550003",
      });
      expect.fail("should have thrown");
    } catch (e) {
      expect((e as ClickToCallError).code).toBe("missing_contact_phone");
    }
  });

  it("throws missing_caller_id when callerId is null", () => {
    try {
      validateClickToCallInput({
        agentPhoneRaw: "+14155550001",
        contactPhoneRaw: "+14155550002",
        callerId: null,
      });
      expect.fail("should have thrown");
    } catch (e) {
      expect((e as ClickToCallError).code).toBe("missing_caller_id");
    }
  });
});

describe("buildBridgeTwiml", () => {
  it("includes a Dial verb with the contact phone + caller ID", () => {
    const xml = buildBridgeTwiml({
      contactPhone: "+14155550002",
      callerId: "+14155550003",
    });
    expect(xml).toContain('callerId="+14155550003"');
    expect(xml).toContain(">+14155550002</Dial>");
  });

  it("adds a whisper Say verb when whisper is provided", () => {
    const xml = buildBridgeTwiml({
      contactPhone: "+14155550002",
      callerId: "+14155550003",
      whisper: "Calling Jane Smith now.",
    });
    expect(xml).toContain("<Say");
    expect(xml).toContain("Calling Jane Smith now.");
    // Whisper should appear before the Dial.
    expect(xml.indexOf("<Say")).toBeLessThan(xml.indexOf("<Dial"));
  });

  it("omits whisper when blank or whitespace", () => {
    const xml = buildBridgeTwiml({
      contactPhone: "+14155550002",
      callerId: "+14155550003",
      whisper: "   ",
    });
    expect(xml).not.toContain("<Say");
  });

  it("escapes XML characters in whisper text", () => {
    const xml = buildBridgeTwiml({
      contactPhone: "+14155550002",
      callerId: "+14155550003",
      whisper: 'Calling <script>x</script> & "Jane"',
    });
    expect(xml).not.toContain("<script>");
    expect(xml).toContain("&lt;script&gt;");
    expect(xml).toContain("&amp;");
    expect(xml).toContain("&quot;Jane&quot;");
  });

  it("includes status callback action when provided", () => {
    const xml = buildBridgeTwiml({
      contactPhone: "+14155550002",
      callerId: "+14155550003",
      statusCallbackUrl: "https://example.com/cb",
    });
    expect(xml).toContain('action="https://example.com/cb"');
    expect(xml).toContain('method="POST"');
  });

  it("starts with the XML declaration and Response root", () => {
    const xml = buildBridgeTwiml({
      contactPhone: "+14155550002",
      callerId: "+14155550003",
    });
    expect(xml.startsWith('<?xml version="1.0"')).toBe(true);
    expect(xml).toContain("<Response>");
    expect(xml).toContain("</Response>");
  });
});
