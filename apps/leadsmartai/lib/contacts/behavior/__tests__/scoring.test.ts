import { describe, expect, it } from "vitest";
import {
  BEHAVIOR_EVENT_TYPES,
  detectIntentSignals,
  isBehaviorEventType,
  scoreBehavior,
  type BehaviorEvent,
} from "../scoring";

const now = new Date("2026-04-20T12:00:00Z");

function ev(eventType: string, daysAgo: number, payload?: Record<string, unknown>): BehaviorEvent {
  return {
    eventType,
    createdAt: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000),
    payload,
  };
}

describe("scoreBehavior", () => {
  it("returns zero score on empty events", () => {
    const r = scoreBehavior([], { now });
    expect(r.score).toBe(0);
    expect(r.factors).toEqual([]);
  });

  it("ignores unknown event types", () => {
    const r = scoreBehavior([ev("unknown_event", 0)], { now });
    expect(r.score).toBe(0);
  });

  it("decays with age — zero beyond 30 days", () => {
    const fresh = scoreBehavior([ev("property_favorite", 0)], { now });
    const stale = scoreBehavior([ev("property_favorite", 31)], { now });
    expect(fresh.score).toBeGreaterThan(0);
    expect(stale.score).toBe(0);
  });

  it("halves weight at 14 days (half-life)", () => {
    const day0 = scoreBehavior([ev("property_favorite", 0)], { now });
    const day14 = scoreBehavior([ev("property_favorite", 14)], { now });
    // within rounding tolerance
    expect(day14.score).toBeLessThan(day0.score);
    expect(day14.score).toBeGreaterThanOrEqual(Math.floor(day0.score / 2) - 1);
    expect(day14.score).toBeLessThanOrEqual(Math.ceil(day0.score / 2) + 1);
  });

  it("sums weights from multiple events and clamps at 100", () => {
    const many: BehaviorEvent[] = [];
    for (let i = 0; i < 50; i++) many.push(ev("property_favorite", 0));
    const r = scoreBehavior(many, { now });
    expect(r.score).toBe(100);
  });

  it("orders factors by weight desc", () => {
    const events = [
      ev("property_view", 0),
      ev("property_view", 0),
      ev("property_favorite", 0),
    ];
    const r = scoreBehavior(events, { now });
    expect(r.factors[0].eventType).toBe("property_favorite");
  });
});

describe("detectIntentSignals", () => {
  it("fires specific_property_interest after 3 views of same property in 48h", () => {
    const events = [
      ev("property_view", 0, { property_id: "abc", address: "1647 Arriba Dr" }),
      ev("property_view", 0.5, { property_id: "abc", address: "1647 Arriba Dr" }),
      ev("property_view", 1, { property_id: "abc", address: "1647 Arriba Dr" }),
    ];
    const signals = detectIntentSignals(events, { now });
    const sig = signals.find((s) => s.signalType === "specific_property_interest");
    expect(sig).toBeDefined();
    expect(sig?.label).toContain("1647 Arriba Dr");
    expect(sig?.dedupKey).toBe("specific_property_interest:abc");
  });

  it("does not fire specific_property_interest for 2 views", () => {
    const events = [
      ev("property_view", 0, { property_id: "abc" }),
      ev("property_view", 0, { property_id: "abc" }),
    ];
    const signals = detectIntentSignals(events, { now });
    expect(signals.find((s) => s.signalType === "specific_property_interest")).toBeUndefined();
  });

  it("does not fire specific_property_interest for views > 48h old", () => {
    const events = [
      ev("property_view", 3, { property_id: "abc" }),
      ev("property_view", 3, { property_id: "abc" }),
      ev("property_view", 3, { property_id: "abc" }),
    ];
    const signals = detectIntentSignals(events, { now });
    expect(signals.find((s) => s.signalType === "specific_property_interest")).toBeUndefined();
  });

  it("rates 5+ views as high confidence", () => {
    const events = Array.from({ length: 5 }, () =>
      ev("property_view", 0.1, { property_id: "abc" }),
    );
    const signals = detectIntentSignals(events, { now });
    const sig = signals.find((s) => s.signalType === "specific_property_interest");
    expect(sig?.confidence).toBe("high");
  });

  it("fires high_intent_returning after 6+ interactions in 3 days", () => {
    const events = [
      ev("property_view", 0, { property_id: "a" }),
      ev("property_view", 0.5, { property_id: "b" }),
      ev("property_view", 1, { property_id: "c" }),
      ev("search_performed", 1.2),
      ev("property_favorite", 2, { property_id: "d" }),
      ev("property_share", 2.5, { property_id: "e" }),
    ];
    const signals = detectIntentSignals(events, { now });
    expect(signals.find((s) => s.signalType === "high_intent_returning")).toBeDefined();
  });

  it("does not fire high_intent_returning for < 6 interactions", () => {
    const events = [
      ev("property_view", 0, { property_id: "a" }),
      ev("property_view", 1, { property_id: "b" }),
      ev("search_performed", 2),
    ];
    const signals = detectIntentSignals(events, { now });
    expect(signals.find((s) => s.signalType === "high_intent_returning")).toBeUndefined();
  });

  it("fires saved_search_created for recent saves, dedup by search id", () => {
    const events = [
      ev("saved_search_created", 0.5, { saved_search_id: "s1", name: "Monterey Park 3bd" }),
    ];
    const signals = detectIntentSignals(events, { now });
    const sig = signals.find((s) => s.signalType === "saved_search_created");
    expect(sig?.dedupKey).toBe("saved_search_created:s1");
  });
});

describe("BEHAVIOR_EVENT_TYPES", () => {
  it("isBehaviorEventType accepts canonical types, rejects others", () => {
    for (const t of BEHAVIOR_EVENT_TYPES) {
      expect(isBehaviorEventType(t)).toBe(true);
    }
    expect(isBehaviorEventType("wat")).toBe(false);
    expect(isBehaviorEventType("")).toBe(false);
  });
});
