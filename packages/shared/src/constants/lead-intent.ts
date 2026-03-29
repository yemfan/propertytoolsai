export const LEAD_INTENT = {
  Buy: "buy",
  Sell: "sell",
  Invest: "invest",
  Rent: "rent",
  Refinance: "refinance",
  Unknown: "unknown",
} as const;

export type LeadIntent = (typeof LEAD_INTENT)[keyof typeof LEAD_INTENT];
