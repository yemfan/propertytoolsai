export const VALUATION_CONFIDENCE = {
  Low: "low",
  Medium: "medium",
  High: "high",
} as const;

export type ValuationConfidenceLabel =
  (typeof VALUATION_CONFIDENCE)[keyof typeof VALUATION_CONFIDENCE];
