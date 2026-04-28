import { describe, expect, it } from "vitest";
import { mapProviderEventType, nextEnvelopeStatus } from "../statusMapping";

describe("mapProviderEventType", () => {
  describe("dotloop", () => {
    it("maps loop.sent → sent", () => {
      expect(mapProviderEventType("dotloop", "loop.sent")).toBe("sent");
    });
    it("maps document.signed → signed", () => {
      expect(mapProviderEventType("dotloop", "document.signed")).toBe("signed");
    });
    it("maps loop.completed → completed", () => {
      expect(mapProviderEventType("dotloop", "loop.completed")).toBe("completed");
    });
    it("maps loop.reminder.sent → reminded", () => {
      expect(mapProviderEventType("dotloop", "loop.reminder.sent")).toBe("reminded");
    });
  });

  describe("docusign", () => {
    it("maps envelope-sent → sent", () => {
      expect(mapProviderEventType("docusign", "envelope-sent")).toBe("sent");
    });
    it("maps recipient-completed → signed (per-recipient signature)", () => {
      expect(mapProviderEventType("docusign", "recipient-completed")).toBe("signed");
    });
    it("maps envelope-completed → completed (all signed)", () => {
      expect(mapProviderEventType("docusign", "envelope-completed")).toBe("completed");
    });
    it("maps envelope-resent → reminded", () => {
      expect(mapProviderEventType("docusign", "envelope-resent")).toBe("reminded");
    });
  });

  describe("hellosign", () => {
    it("maps signature_request_signed → signed", () => {
      expect(mapProviderEventType("hellosign", "signature_request_signed")).toBe("signed");
    });
    it("maps signature_request_all_signed → completed", () => {
      expect(mapProviderEventType("hellosign", "signature_request_all_signed")).toBe("completed");
    });
    it("maps signature_request_canceled → voided", () => {
      expect(mapProviderEventType("hellosign", "signature_request_canceled")).toBe("voided");
    });
  });

  it("returns null for unrecognized event names so the webhook can 200 + skip", () => {
    expect(mapProviderEventType("dotloop", "loop.metadata.updated")).toBeNull();
    expect(mapProviderEventType("docusign", "envelope-not-real")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(mapProviderEventType("docusign", "ENVELOPE-SENT")).toBe("sent");
    expect(mapProviderEventType("dotloop", "Loop.Completed")).toBe("completed");
  });
});

describe("nextEnvelopeStatus", () => {
  it("advances to 'completed' when the event is completed (terminal)", () => {
    expect(nextEnvelopeStatus({ current: "viewed", event: "completed" })).toBe("completed");
    expect(nextEnvelopeStatus({ current: "sent", event: "completed" })).toBe("completed");
  });

  it("advances to 'declined' / 'voided' / 'expired' regardless of current", () => {
    expect(nextEnvelopeStatus({ current: "viewed", event: "declined" })).toBe("declined");
    expect(nextEnvelopeStatus({ current: "signed", event: "voided" })).toBe("voided");
    expect(nextEnvelopeStatus({ current: "sent", event: "expired" })).toBe("expired");
  });

  it("promotes 'signed' to 'completed' when allSigned=true (last signer)", () => {
    expect(
      nextEnvelopeStatus({ current: "signed", event: "signed", allSigned: true }),
    ).toBe("completed");
  });

  it("advances 'sent' or 'viewed' → 'signed' when a signer signs (not last)", () => {
    expect(nextEnvelopeStatus({ current: "sent", event: "signed" })).toBe("signed");
    expect(nextEnvelopeStatus({ current: "viewed", event: "signed" })).toBe("signed");
  });

  it("doesn't regress signed → viewed (one signer views after another signed)", () => {
    expect(nextEnvelopeStatus({ current: "signed", event: "viewed" })).toBe("signed");
  });

  it("advances 'sent' → 'viewed' on first view", () => {
    expect(nextEnvelopeStatus({ current: "sent", event: "viewed" })).toBe("viewed");
  });

  it("ignores 'reminded' events for envelope status", () => {
    expect(nextEnvelopeStatus({ current: "sent", event: "reminded" })).toBe("sent");
    expect(nextEnvelopeStatus({ current: "viewed", event: "reminded" })).toBe("viewed");
  });

  it("ignores 'sent' events when envelope is already past sent", () => {
    expect(nextEnvelopeStatus({ current: "viewed", event: "sent" })).toBe("viewed");
    expect(nextEnvelopeStatus({ current: "signed", event: "sent" })).toBe("signed");
  });
});
