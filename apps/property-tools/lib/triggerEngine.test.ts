import { describe, expect, it } from "vitest";
import { checkTriggers } from "./triggerEngine";
import type { UserProfile } from "./userProfile";

function profile(p: Partial<UserProfile>): UserProfile {
  return {
    intent: "browser",
    priceRange: null,
    location: null,
    urgency: "low",
    totalEvents: 0,
    signals: {},
    ...p,
  };
}

describe("checkTriggers", () => {
  it("fires outreach when score > 70", () => {
    const r = checkTriggers({
      profile: profile({
        urgency: "high",
        intent: "investor",
        signals: {
          comparison_started: 3,
          cma_used: 2,
          mortgage_used: 2,
          agent_clicked: 1,
        },
        totalEvents: 20,
      }),
    });
    expect(r.shouldOutreach).toBe(true);
    expect(r.trigger).toBe("high_intent");
    expect(r.prediction.score).toBeGreaterThan(70);
  });

  it("does not fire for cold profiles", () => {
    const r = checkTriggers({
      profile: profile({ signals: {}, totalEvents: 1 }),
    });
    expect(r.shouldOutreach).toBe(false);
    expect(r.trigger).toBe("none");
  });
});
