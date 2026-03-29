export type LoanProgram = "conventional" | "fha" | "va" | "jumbo";

export type AffordabilityInput = {
  sessionId: string;
  annualIncome: number;
  monthlyDebts: number;
  downPayment: number;
  downPaymentMode: "amount" | "percent";
  downPaymentPercent?: number;
  interestRate: number;
  loanTermYears: number;
  propertyTaxRate: number;
  annualHomeInsurance: number;
  monthlyHoa?: number;
  dtiFrontLimit?: number;
  dtiBackLimit?: number;
  loanProgram?: LoanProgram;
  creditScore?: number;
  zip?: string;
  firstTimeBuyer?: boolean;
};

export type MonthlyPaymentBreakdown = {
  principalAndInterest: number;
  propertyTax: number;
  homeInsurance: number;
  hoa: number;
  pmi: number;
  totalHousingPayment: number;
};

export type AffordabilityScenario = {
  interestRate: number;
  maxHomePrice: number;
  loanAmount: number;
  monthlyPayment: number;
};

export type AffordabilityResult = {
  maxHomePrice: number;
  targetLoanAmount: number;
  maxMonthlyHousingBudget: number;
  downPaymentAmount: number;
  dti: {
    frontRatio: number;
    backRatio: number;
    frontLimit: number;
    backLimit: number;
  };
  monthlyBreakdown: MonthlyPaymentBreakdown;
  scenarios: AffordabilityScenario[];
  summary: string;
  recommendations: string[];
};

export type AffordabilitySessionRecord = {
  sessionId: string;
  input: Omit<AffordabilityInput, "sessionId">;
  result: AffordabilityResult;
};

/** Buyer intent for Affordability Report V2 (homes CTA, lender panel). */
export type BuyerIntentState = {
  preferredCity?: string;
  preferredZip?: string;
  preferredPropertyType?: "single_family" | "condo" | "townhome" | "multi_family";
  timeline?: "now" | "3_months" | "6_months" | "exploring";
  firstTimeBuyer?: boolean;
  alreadyPreapproved?: boolean;
  veteran?: boolean;
};

/** Alias for V2 UI — same shape as {@link AffordabilityResult}. */
export type AffordabilityResultV2 = AffordabilityResult;
