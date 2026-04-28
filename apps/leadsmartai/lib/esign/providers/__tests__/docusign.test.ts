import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { docusignParser } from "../docusign";

describe("docusignParser.parseEvent", () => {
  it("maps envelope-completed → completed", () => {
    const out = docusignParser.parseEvent({
      event: "envelope-completed",
      uri: "/restapi/v2.1/...",
      generatedDateTime: "2026-04-28T10:00:00Z",
      data: { envelopeId: "env_abc" },
    });
    expect(out).toEqual({
      providerId: "env_abc",
      externalEventId: "/restapi/v2.1/...",
      eventType: "completed",
      signerIndex: null,
      occurredAt: "2026-04-28T10:00:00Z",
    });
  });

  it("converts DocuSign 1-based recipientId to 0-based signer index", () => {
    const out = docusignParser.parseEvent({
      event: "recipient-completed",
      data: { envelopeId: "env_abc", recipientId: "2" },
    });
    expect(out?.signerIndex).toBe(1); // recipientId "2" → index 1
  });

  it("returns null on unrecognized event", () => {
    expect(
      docusignParser.parseEvent({
        event: "envelope-snoozed",
        data: { envelopeId: "env_abc" },
      }),
    ).toBeNull();
  });

  it("returns null when envelopeId is missing", () => {
    expect(
      docusignParser.parseEvent({ event: "envelope-sent", data: {} }),
    ).toBeNull();
  });

  it("nulls out signerIndex when recipientId is malformed", () => {
    const out = docusignParser.parseEvent({
      event: "recipient-completed",
      data: { envelopeId: "env_abc", recipientId: "not-a-number" },
    });
    expect(out?.signerIndex).toBeNull();
  });
});

describe("docusignParser.verifySignature", () => {
  it("accepts when DOCUSIGN_WEBHOOK_SECRET is unset", () => {
    const original = process.env.DOCUSIGN_WEBHOOK_SECRET;
    delete process.env.DOCUSIGN_WEBHOOK_SECRET;
    try {
      expect(
        docusignParser.verifySignature({
          rawBody: '{"event":"envelope-sent"}',
          headers: {},
        }),
      ).toBe(true);
    } finally {
      if (original) process.env.DOCUSIGN_WEBHOOK_SECRET = original;
    }
  });

  it("accepts when ANY of multiple X-DocuSign-Signature-N headers matches (rotation)", () => {
    process.env.DOCUSIGN_WEBHOOK_SECRET = "secret-current";
    try {
      const body = '{"event":"envelope-sent"}';
      const sigCurrent = createHmac("sha256", "secret-current")
        .update(body)
        .digest("base64");
      expect(
        docusignParser.verifySignature({
          rawBody: body,
          headers: {
            "x-docusign-signature-1": "wrong-sig-from-old-rotated-key",
            "x-docusign-signature-2": sigCurrent,
          },
        }),
      ).toBe(true);
    } finally {
      delete process.env.DOCUSIGN_WEBHOOK_SECRET;
    }
  });

  it("rejects when none of the signature headers match", () => {
    process.env.DOCUSIGN_WEBHOOK_SECRET = "secret";
    try {
      expect(
        docusignParser.verifySignature({
          rawBody: '{"event":"envelope-sent"}',
          headers: { "x-docusign-signature-1": "definitely-not-correct" },
        }),
      ).toBe(false);
    } finally {
      delete process.env.DOCUSIGN_WEBHOOK_SECRET;
    }
  });
});
