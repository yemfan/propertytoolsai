import { describe, expect, it } from "vitest";
import { dotloopParser } from "../dotloop";

describe("dotloopParser.parseEvent", () => {
  it("maps a loop.completed payload to a completed event", () => {
    const out = dotloopParser.parseEvent({
      event: "loop.completed",
      eventId: "evt_1",
      occurredAt: "2026-04-28T10:00:00Z",
      loop: { id: "loop_abc", name: "Smith / 123 Main" },
    });
    expect(out).toEqual({
      providerId: "loop_abc",
      externalEventId: "evt_1",
      eventType: "completed",
      signerIndex: null,
      occurredAt: "2026-04-28T10:00:00Z",
    });
  });

  it("captures signer index on per-participant signed events", () => {
    const out = dotloopParser.parseEvent({
      event: "document.signed",
      eventId: "evt_2",
      loop: { id: "loop_abc" },
      participant: { index: 1, email: "buyer@example.com" },
    });
    expect(out?.eventType).toBe("signed");
    expect(out?.signerIndex).toBe(1);
  });

  it("returns null on unrecognized event", () => {
    expect(
      dotloopParser.parseEvent({
        event: "loop.metadata.refreshed",
        loop: { id: "loop_abc" },
      }),
    ).toBeNull();
  });

  it("returns null when loop.id is missing", () => {
    expect(
      dotloopParser.parseEvent({ event: "loop.completed", loop: {} }),
    ).toBeNull();
  });

  it("returns null on non-object payloads", () => {
    expect(dotloopParser.parseEvent(null)).toBeNull();
    expect(dotloopParser.parseEvent("string")).toBeNull();
    expect(dotloopParser.parseEvent(42)).toBeNull();
  });

  it("falls back to occurred_at (snake_case) when occurredAt is missing", () => {
    const out = dotloopParser.parseEvent({
      event: "loop.sent",
      occurred_at: "2026-04-28T11:00:00Z",
      loop: { id: "loop_abc" },
    });
    expect(out?.occurredAt).toBe("2026-04-28T11:00:00Z");
  });
});

describe("dotloopParser.verifySignature", () => {
  it("accepts when DOTLOOP_WEBHOOK_SECRET is unset (dev mode)", () => {
    const original = process.env.DOTLOOP_WEBHOOK_SECRET;
    delete process.env.DOTLOOP_WEBHOOK_SECRET;
    try {
      expect(
        dotloopParser.verifySignature({
          rawBody: '{"event":"loop.sent"}',
          headers: {},
        }),
      ).toBe(true);
    } finally {
      if (original) process.env.DOTLOOP_WEBHOOK_SECRET = original;
    }
  });

  it("rejects when secret is set but no signature header is present", () => {
    process.env.DOTLOOP_WEBHOOK_SECRET = "test-secret";
    try {
      expect(
        dotloopParser.verifySignature({
          rawBody: '{"event":"loop.sent"}',
          headers: {},
        }),
      ).toBe(false);
    } finally {
      delete process.env.DOTLOOP_WEBHOOK_SECRET;
    }
  });

  it("accepts a valid HMAC-SHA256 signature", async () => {
    const { createHmac } = await import("node:crypto");
    process.env.DOTLOOP_WEBHOOK_SECRET = "test-secret";
    try {
      const body = '{"event":"loop.sent"}';
      const sig = createHmac("sha256", "test-secret").update(body).digest("hex");
      expect(
        dotloopParser.verifySignature({
          rawBody: body,
          headers: { "x-dotloop-signature": sig },
        }),
      ).toBe(true);
    } finally {
      delete process.env.DOTLOOP_WEBHOOK_SECRET;
    }
  });

  it("rejects a tampered body", async () => {
    const { createHmac } = await import("node:crypto");
    process.env.DOTLOOP_WEBHOOK_SECRET = "test-secret";
    try {
      const body = '{"event":"loop.sent"}';
      const sig = createHmac("sha256", "test-secret").update(body).digest("hex");
      expect(
        dotloopParser.verifySignature({
          rawBody: body + "tampered",
          headers: { "x-dotloop-signature": sig },
        }),
      ).toBe(false);
    } finally {
      delete process.env.DOTLOOP_WEBHOOK_SECRET;
    }
  });
});
