/**
 * LeadSmart deal prediction (3–6 month buy/sell likelihood).
 * Scores are persisted on `public.leads`; factors explain the breakdown.
 */
export type DealPredictionLabel = "low" | "medium" | "high";

export type DealPredictionFactor = {
  id: string;
  label: string;
  pointsEarned: number;
  pointsMax: number;
  detail: string;
};

export type DealPredictionResult = {
  score: number;
  label: DealPredictionLabel;
  factors: DealPredictionFactor[];
};
