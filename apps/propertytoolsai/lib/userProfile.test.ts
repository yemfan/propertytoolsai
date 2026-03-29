import { describe, expect, it } from "vitest";
import { buildUserProfile } from "./userProfile";
import type { StoredBehaviorEvent } from "./behaviorStore";

function ev(
  type: string,
  ts: number,
  metadata: Record<string, unknown> = {}
): StoredBehaviorEvent {
  return { type, ts, metadata };
}

describe("buildUserProfile", () => {
  it("infers buyer from mortgage signals", () => {
    const now = Date.now();
    const events: StoredBehaviorEvent[] = [
      ev("mortgage_used", now - 1000, { homePrice: 400000 }),
      ev("mortgage_used", now - 2000, { homePrice: 410000 }),
    ];
    const p = buildUserProfile(events);
    expect(p.intent).toBe("buyer");
    expect(p.priceRange).not.toBeNull();
  });

  it("infers investor from comparison + cap rate", () => {
    const now = Date.now();
    const events: StoredBehaviorEvent[] = [
      ev("comparison_started", now - 1000, {}),
      ev("cap_rate_used", now - 2000, {}),
    ];
    const p = buildUserProfile(events);
    expect(p.intent).toBe("investor");
  });
});
