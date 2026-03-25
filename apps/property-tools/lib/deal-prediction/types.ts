export type PredictionFactor = {
  label: string;
  impact: "positive" | "negative" | "neutral";
  weight: number;
  reason: string;
};

export type LeadPredictionFeatures = {
  source: string | null;
  intent: string | null;
  leadScore: number;
  engagementScore: number;
  leadTemperature: string | null;
  hoursSinceLastActivity: number | null;
  inboundMessageCount: number;
  outboundMessageCount: number;
  hasReplyFromLead: boolean;
  hasTourRequest: boolean;
  hasAppointmentSignal: boolean;
  assignedAgentId: string | null;
  avgResponseMinutes: number | null;
  pricePoint: number;
  hasPhone: boolean;
  hasEmail: boolean;
  sourceSessionId: string | null;
  city: string | null;
};

export type LeadPredictionResult = {
  closeProbability: number;
  predictedDealValue: number;
  predictedCloseWindow: "0-7 days" | "8-30 days" | "31-90 days" | "90+ days";
  factors: PredictionFactor[];
};
