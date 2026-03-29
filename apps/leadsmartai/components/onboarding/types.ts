export type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type LeadFocus = "buyers" | "sellers" | "both";

export type PriceRangeId = "under-750" | "750-1500" | "1500-plus";

export type OnboardingProfile = {
  fullName: string;
  email: string;
  city: string;
  focus: LeadFocus;
  priceRangeId: PriceRangeId;
};

export type DemoMessage = {
  id: string;
  from: "lead" | "agent";
  text: string;
  at: string;
};

export type DemoLead = {
  id: string;
  name: string;
  initials: string;
  intent: "Buyer" | "Seller" | "Investor";
  budget: string;
  area: string;
  timeline: string;
  channel: "SMS" | "Web" | "Portal";
  snippet: string;
  score: number;
  waitingSinceMin: number;
  messages: DemoMessage[];
};

export type OnboardingPersisted = {
  version: 1;
  step: OnboardingStep;
  profile: Partial<OnboardingProfile>;
  selectedLeadId: string | null;
  hasReplied: boolean;
  paywallSeen: boolean;
  engagementPoints: number;
  completedAt: string | null;
};
