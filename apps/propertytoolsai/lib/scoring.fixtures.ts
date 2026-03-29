/**
 * Documented sample scenarios for QA / future ML regression baselines.
 * Not executed at runtime unless imported by tests.
 */

import type { LeadScoringInput } from "@/lib/scoring";
import { calculateLeadScore } from "@/lib/scoring";
import { calculateLeadPrice, calculateLeadPriceDetailed } from "@/lib/pricing";

/** High-intent seller with full data + premium home — expect ~95 score, tier $120+ */
export const SAMPLE_HIGH_SELLER_1_2M: LeadScoringInput = {
  intent: "sell",
  tool_used: "home_value",
  email: "seller@example.com",
  phone: "(555) 555-0100",
  property_value: 1_200_000,
  timeframe: "immediate",
  distinct_tools_used: 1,
};

/** Buyer using mortgage tool, minimal contact + exploring — medium score */
export const SAMPLE_MEDIUM_BUYER_LOW_ENGAGEMENT: LeadScoringInput = {
  intent: "buy",
  tool_used: "mortgage",
  email: "buyer@example.com",
  phone: null,
  property_value: null,
  timeframe: "exploring",
  distinct_tools_used: 1,
};

/** Anonymous / thin profile — low score */
export const SAMPLE_ANONYMOUS_THIN: LeadScoringInput = {
  intent: "buy",
  tool_used: null,
  email: null,
  phone: null,
  property_value: null,
  timeframe: null,
  distinct_tools_used: 0,
};

export function summarizeFixtureExpectations() {
  return {
    highSeller: {
      input: SAMPLE_HIGH_SELLER_1_2M,
      score: calculateLeadScore(SAMPLE_HIGH_SELLER_1_2M),
      price: calculateLeadPrice(calculateLeadScore(SAMPLE_HIGH_SELLER_1_2M)),
    },
    mediumBuyer: {
      input: SAMPLE_MEDIUM_BUYER_LOW_ENGAGEMENT,
      score: calculateLeadScore(SAMPLE_MEDIUM_BUYER_LOW_ENGAGEMENT),
      price: calculateLeadPrice(calculateLeadScore(SAMPLE_MEDIUM_BUYER_LOW_ENGAGEMENT)),
    },
    anonymous: {
      input: SAMPLE_ANONYMOUS_THIN,
      score: calculateLeadScore(SAMPLE_ANONYMOUS_THIN),
      price: calculateLeadPrice(calculateLeadScore(SAMPLE_ANONYMOUS_THIN)),
    },
    caNyUplift: calculateLeadPriceDetailed(92, { state: "CA", property_value: 2_000_000 }),
  };
}
