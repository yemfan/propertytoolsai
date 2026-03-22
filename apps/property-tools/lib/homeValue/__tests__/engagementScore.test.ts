import { describe, expect, it } from "vitest";
import { computeHomeValueEngagementScore, crmIntentFromLikelyIntent } from "../engagementScore";

describe("computeHomeValueEngagementScore", () => {
  it("returns 0–100", () => {
    const s = computeHomeValueEngagementScore({
      confidenceScore: 80,
      fieldsCompleteRatio: 0.9,
      pricedCompCount: 4,
      hasEstimate: true,
      requestedFullReport: true,
      likelyIntent: "seller",
    });
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });
});

describe("crmIntentFromLikelyIntent", () => {
  it("maps buyer and seller", () => {
    expect(crmIntentFromLikelyIntent("buyer")).toBe("buy");
    expect(crmIntentFromLikelyIntent("seller")).toBe("sell");
    expect(crmIntentFromLikelyIntent("investor")).toBe("sell");
  });
});
