export type UserRole = "agent" | "user";

export type LeadRating = "hot" | "warm" | "cold";

export type LeadIntent = "low" | "medium" | "high";

export type LeadTimeline = "0-3m" | "3-6m" | "6m+";

export type User = {
  id: string;
  role: UserRole;
  email?: string | null;
  full_name?: string | null;
};

export type Lead = {
  id: string;
  agent_id?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  property_address?: string | null;
  lead_status?: string | null;
  rating?: LeadRating | null;
  engagement_score?: number | null;
  last_activity_at?: string | null;
  created_at?: string;
  // AI lead scoring (optional)
  ai_lead_score?: number | null;
  ai_intent?: LeadIntent | null;
  ai_timeline?: LeadTimeline | null;
  ai_confidence?: number | null;
  ai_explanation?: string[] | null;
};

export type Property = {
  id?: string | number | null;
  address: string;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  lat?: number | null;
  lng?: number | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  price?: number | null;
  rent?: number | null;
};

export type MortgageInput = {
  homePrice: number;
  downPayment: number;
  loanTermYears: number;
  annualInterestRate: number; // e.g. 6.5
};

export type MortgageResult = {
  principal: number;
  monthlyPayment: number;
  totalInterest: number;
  totalPayment: number;
};

export type AffordabilityInput = {
  annualIncome: number;
  monthlyDebts: number;
  downPayment: number;
  loanTermYears: number;
  annualInterestRate: number; // e.g. 6.5
  dtiRatio?: number; // defaults to 0.36
};

export type AffordabilityResult = {
  maxHomePrice: number;
  estimatedMonthlyPayment: number;
};

export type RefinanceInput = {
  currentBalance: number;
  currentAnnualInterestRate: number;
  newAnnualInterestRate: number;
  remainingTermYears: number;
  closingCosts: number;
};

export type RefinanceResult = {
  paymentBefore: number;
  paymentAfter: number;
  monthlySavings: number;
  breakEvenMonths: number;
};

export type HomeValueEstimate = {
  value: number;
  low: number;
  high: number;
  displayValue: string;
  displayLow: string;
  displayHigh: string;
};

