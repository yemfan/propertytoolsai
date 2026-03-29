export const LEAD_TEMPERATURE = {
  Hot: "hot",
  Warm: "warm",
  Cold: "cold",
} as const;

export type LeadTemperatureLevel = (typeof LEAD_TEMPERATURE)[keyof typeof LEAD_TEMPERATURE];
