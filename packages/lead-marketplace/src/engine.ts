/**
 * Pluggable marketplace engine — swap `rulesMarketplaceEngine` for an AI/ML implementation
 * that still returns numeric score + USD price.
 */

import type { LeadPricingOptions } from "./pricing";
import { calculateLeadPrice } from "./pricing";
import type { LeadScoringInput } from "./scoring";
import { calculateLeadScore } from "./scoring";

export interface LeadMarketplaceEngine {
  score(input: LeadScoringInput): number;
  price(score: number, options?: LeadPricingOptions): number;
}

/** Current production implementation (rules). */
export const rulesMarketplaceEngine: LeadMarketplaceEngine = {
  score: calculateLeadScore,
  price: calculateLeadPrice,
};
