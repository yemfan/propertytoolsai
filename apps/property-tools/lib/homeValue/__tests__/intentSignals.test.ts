import { describe, expect, it } from "vitest";
import {
  looksLikeListingAddress,
  pickLikelyIntentFromScores,
  priceSpreadImpliesValueFocus,
  scoreIntentSignals,
} from "../intentSignals";
import { resolveLikelyIntent } from "../intentInference";

describe("scoreIntentSignals", () => {
  it("applies example weights from spec", () => {
    const s = scoreIntentSignals({
      homeValueUsed: true,
      fullReportUnlocked: true,
      mortgageAfterEstimate: true,
      comparisonToolUsed: true,
      rentOrRoiOrCapToolUsed: true,
    });
    expect(s.seller).toBe(25 + 15);
    expect(s.buyer).toBe(15 + 10);
    expect(s.investor).toBe(10 + 20);
  });
});

describe("pickLikelyIntentFromScores", () => {
  it("returns unknown when all zero", () => {
    expect(pickLikelyIntentFromScores({ seller: 0, buyer: 0, investor: 0 })).toBe("unknown");
  });

  it("breaks ties seller > buyer > investor", () => {
    expect(pickLikelyIntentFromScores({ seller: 50, buyer: 50, investor: 40 })).toBe("seller");
    // Buyer beats investor when both tie for max (seller > buyer > investor priority).
    expect(pickLikelyIntentFromScores({ seller: 40, buyer: 50, investor: 50 })).toBe("buyer");
  });
});

describe("looksLikeListingAddress", () => {
  it("detects unit-style addresses", () => {
    expect(looksLikeListingAddress("123 Main St #4B")).toBe(true);
    expect(looksLikeListingAddress("456 Oak Ave")).toBe(false);
  });
});

describe("priceSpreadImpliesValueFocus", () => {
  it("flags wide bands", () => {
    expect(priceSpreadImpliesValueFocus(0.15)).toBe(true);
    expect(priceSpreadImpliesValueFocus(0.08)).toBe(false);
  });
});

describe("resolveLikelyIntent", () => {
  it("honors explicit over signals", () => {
    const r = resolveLikelyIntent({
      explicit: "buyer",
      signals: { homeValueUsed: true, fullReportUnlocked: true },
      propertyType: "single family",
      priceSpreadRatio: null,
    });
    expect(r.intent).toBe("buyer");
    expect(r.scores.seller).toBeGreaterThan(0);
  });

  it("infers from signals when explicit omitted", () => {
    const r = resolveLikelyIntent({
      signals: {
        mortgageAfterEstimate: true,
        comparisonToolUsed: true,
        rentOrRoiOrCapToolUsed: true,
      },
      propertyType: "single family",
      priceSpreadRatio: null,
    });
    expect(r.intent).toBe("investor");
    expect(r.likely).toBe("investor");
  });
});
