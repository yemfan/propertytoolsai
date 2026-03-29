import { describe, expect, it } from "vitest";
import { calculateLeadScore } from "@/lib/scoring";
import { calculateLeadPrice, calculateLeadPriceDetailed } from "@/lib/pricing";
import {
  SAMPLE_ANONYMOUS_THIN,
  SAMPLE_HIGH_SELLER_1_2M,
  SAMPLE_MEDIUM_BUYER_LOW_ENGAGEMENT,
} from "@/lib/scoring.fixtures";

describe("calculateLeadScore", () => {
  it("scores a high seller with $1.2M home in the high band", () => {
    expect(calculateLeadScore(SAMPLE_HIGH_SELLER_1_2M)).toBe(95);
  });

  it("scores a medium buyer with low engagement in the mid band", () => {
    expect(calculateLeadScore(SAMPLE_MEDIUM_BUYER_LOW_ENGAGEMENT)).toBe(52);
  });

  it("scores an anonymous / thin lead low", () => {
    expect(calculateLeadScore(SAMPLE_ANONYMOUS_THIN)).toBe(30);
  });
});

describe("calculateLeadPrice", () => {
  it("maps tiers to base USD", () => {
    expect(calculateLeadPrice(95)).toBe(120);
    expect(calculateLeadPrice(85)).toBe(100);
    expect(calculateLeadPrice(75)).toBe(80);
    expect(calculateLeadPrice(65)).toBe(60);
    expect(calculateLeadPrice(55)).toBe(40);
    expect(calculateLeadPrice(40)).toBe(20);
  });

  it("applies CA/NY +20% and >$1.5M +25% multipliers", () => {
    const q = calculateLeadPriceDetailed(95, { state: "CA", property_value: 2_000_000 });
    expect(q.basePrice).toBe(120);
    expect(q.multiplier).toBeCloseTo(1.2 * 1.25, 5);
    expect(q.price).toBe(180);
  });
});
