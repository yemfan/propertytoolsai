import { describe, expect, it } from "vitest";
import { computeEmailStats } from "../stats";
import type { EmailEvent } from "../types";

function ev(overrides: Partial<EmailEvent> & { eventType: EmailEvent["eventType"] }): EmailEvent {
  return {
    id: "ev-" + Math.random(),
    externalMessageId: "msg-1",
    eventId: null,
    agentId: "agent-1",
    contactId: "00000000-0000-0000-0000-000000000001",
    url: null,
    metadata: {},
    occurredAt: "2026-04-28T00:00:00Z",
    createdAt: "2026-04-28T00:00:00Z",
    ...overrides,
  };
}

describe("computeEmailStats", () => {
  it("returns all zeros for an empty event list", () => {
    expect(computeEmailStats([])).toEqual({
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      openRate: 0,
      clickThroughRate: 0,
    });
  });

  it("counts each event type once", () => {
    const out = computeEmailStats([
      ev({ eventType: "sent", externalMessageId: "m1" }),
      ev({ eventType: "delivered", externalMessageId: "m1" }),
      ev({ eventType: "opened", externalMessageId: "m1" }),
      ev({ eventType: "clicked", externalMessageId: "m1" }),
    ]);
    expect(out.sent).toBe(1);
    expect(out.delivered).toBe(1);
    expect(out.opened).toBe(1);
    expect(out.clicked).toBe(1);
  });

  it("dedupes multiple opens of the same message — open rate stays <=100%", () => {
    const out = computeEmailStats([
      ev({ eventType: "delivered", externalMessageId: "m1" }),
      ev({ eventType: "opened", externalMessageId: "m1" }),
      ev({ eventType: "opened", externalMessageId: "m1" }),
      ev({ eventType: "opened", externalMessageId: "m1" }),
    ]);
    expect(out.opened).toBe(1);
    expect(out.openRate).toBe(1);
  });

  it("openRate is opened/delivered, clickRate is clicked/opened", () => {
    const events: EmailEvent[] = [];
    for (let i = 0; i < 10; i++) {
      events.push(ev({ eventType: "delivered", externalMessageId: `m${i}` }));
    }
    for (let i = 0; i < 4; i++) {
      events.push(ev({ eventType: "opened", externalMessageId: `m${i}` }));
    }
    for (let i = 0; i < 2; i++) {
      events.push(ev({ eventType: "clicked", externalMessageId: `m${i}` }));
    }
    const out = computeEmailStats(events);
    expect(out.delivered).toBe(10);
    expect(out.opened).toBe(4);
    expect(out.clicked).toBe(2);
    expect(out.openRate).toBeCloseTo(0.4);
    expect(out.clickThroughRate).toBeCloseTo(0.5);
  });

  it("avoids divide-by-zero when delivered or opened is 0", () => {
    const out = computeEmailStats([ev({ eventType: "sent" })]);
    expect(out.openRate).toBe(0);
    expect(out.clickThroughRate).toBe(0);
  });

  it("counts bounces but excludes them from open/click rates", () => {
    const out = computeEmailStats([
      ev({ eventType: "delivered", externalMessageId: "m1" }),
      ev({ eventType: "bounced", externalMessageId: "m2" }),
      ev({ eventType: "bounced", externalMessageId: "m3" }),
    ]);
    expect(out.bounced).toBe(2);
    expect(out.delivered).toBe(1);
  });
});
