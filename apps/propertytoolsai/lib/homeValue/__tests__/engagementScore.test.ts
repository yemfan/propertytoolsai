import { describe, expect, it } from "vitest";
import {
  computeEngagementScore,
  computeHomeValueEngagementScore,
  crmIntentFromLikelyIntent,
  leadScoreBand,
  LEAD_SCORE_WEIGHTS,
} from "../engagementScore";

describe("computeEngagementScore (lead scoring)", () => {
  it("sums weights and caps at 100 when all signals true", () => {
    const raw =
      LEAD_SCORE_WEIGHTS.homeValueToolUsed +
      LEAD_SCORE_WEIGHTS.refinedDetailsSubmitted +
      LEAD_SCORE_WEIGHTS.fullReportUnlocked +
      LEAD_SCORE_WEIGHTS.phoneProvided +
      LEAD_SCORE_WEIGHTS.repeatSession +
      LEAD_SCORE_WEIGHTS.clickedCma +
      LEAD_SCORE_WEIGHTS.clickedExpertCta +
      LEAD_SCORE_WEIGHTS.highValueProperty;
    expect(raw).toBe(110);
    expect(
      computeEngagementScore({
        usedTool: true,
        refinedDetails: true,
        unlockedReport: true,
        phoneProvided: true,
        repeatSession: true,
        clickedCma: true,
        clickedExpert: true,
        highValueProperty: true,
      })
    ).toBe(100);
  });

  it("returns 0 when all flags false", () => {
    expect(
      computeEngagementScore({
        usedTool: false,
        refinedDetails: false,
        unlockedReport: false,
        phoneProvided: false,
        repeatSession: false,
        clickedCma: false,
        clickedExpert: false,
        highValueProperty: false,
      })
    ).toBe(0);
  });

  it("partial: home value tool only = 25", () => {
    expect(
      computeEngagementScore({
        usedTool: true,
        refinedDetails: false,
        unlockedReport: false,
        phoneProvided: false,
        repeatSession: false,
        clickedCma: false,
        clickedExpert: false,
        highValueProperty: false,
      })
    ).toBe(25);
  });
});

describe("leadScoreBand", () => {
  it("maps 0–29 low, 30–59 medium, 60+ high", () => {
    expect(leadScoreBand(0)).toBe("low");
    expect(leadScoreBand(29)).toBe("low");
    expect(leadScoreBand(30)).toBe("medium");
    expect(leadScoreBand(59)).toBe("medium");
    expect(leadScoreBand(60)).toBe("high");
    expect(leadScoreBand(100)).toBe("high");
  });
});

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
