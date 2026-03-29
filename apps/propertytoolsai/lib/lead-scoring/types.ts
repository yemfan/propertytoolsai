export type LeadTemperature = "hot" | "warm" | "cold";

export type UpdateLeadScoreResult = {
  score: number;
  temperature: LeadTemperature;
  last_activity_at: string | null;
};
