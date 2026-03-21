import { describe, expect, it } from "vitest";
import { getNextBestActions } from "./recommendation";
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

describe("getNextBestActions", () => {
  it("returns seller-leaning tools for seller intent", () => {
    const actions = getNextBestActions(
      profile({ intent: "seller", signals: { cma_used: 2 }, urgency: "medium" })
    );
    const ids = actions.map((a) => a.id);
    expect(ids).toContain("cma");
    expect(actions[0].priority).toBeGreaterThan(50);
  });

  it("returns non-empty list for browser", () => {
    const actions = getNextBestActions(profile({ intent: "browser" }));
    expect(actions.length).toBeGreaterThan(0);
  });
});
