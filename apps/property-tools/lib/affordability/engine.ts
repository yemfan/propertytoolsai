import type {
  AffordabilityInput,
  AffordabilityResult,
  LoanProgram,
  MonthlyPaymentBreakdown,
} from "./types";

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getDefaultDtiLimits(program?: LoanProgram) {
  switch (program) {
    case "fha":
      return { front: 0.31, back: 0.43 };
    case "va":
      return { front: 0.41, back: 0.5 };
    case "jumbo":
      return { front: 0.36, back: 0.43 };
    case "conventional":
    default:
      return { front: 0.28, back: 0.43 };
  }
}

export function calculateMonthlyMortgagePayment(
  loanAmount: number,
  annualRatePct: number,
  termYears: number
): number {
  if (loanAmount <= 0) return 0;
  const monthlyRate = annualRatePct / 100 / 12;
  const numberOfPayments = termYears * 12;

  if (monthlyRate === 0) {
    return loanAmount / numberOfPayments;
  }

  return (
    (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) /
    (Math.pow(1 + monthlyRate, numberOfPayments) - 1)
  );
}

export function estimateMonthlyPmi(
  loanAmount: number,
  homePrice: number,
  creditScore?: number,
  program?: LoanProgram
): number {
  if (program === "va") return 0;
  if (homePrice <= 0) return 0;

  const ltv = loanAmount / homePrice;
  if (ltv <= 0.8) return 0;

  let annualRate = 0.008;
  if ((creditScore ?? 0) >= 760) annualRate = 0.004;
  else if ((creditScore ?? 0) >= 720) annualRate = 0.005;
  else if ((creditScore ?? 0) >= 680) annualRate = 0.007;
  else annualRate = 0.01;

  if (program === "fha") annualRate = 0.0085;
  return (loanAmount * annualRate) / 12;
}

export function calculateAffordability(input: AffordabilityInput): AffordabilityResult {
  const monthlyIncome = input.annualIncome / 12;
  const dtiDefaults = getDefaultDtiLimits(input.loanProgram);
  const frontLimit = input.dtiFrontLimit ?? dtiDefaults.front;
  const backLimit = input.dtiBackLimit ?? dtiDefaults.back;

  const frontBudget = monthlyIncome * frontLimit;
  const backBudget = monthlyIncome * backLimit - input.monthlyDebts;
  const maxMonthlyHousingBudget = Math.max(0, Math.min(frontBudget, backBudget));

  const hoa = input.monthlyHoa ?? 0;
  const monthlyInsurance = input.annualHomeInsurance / 12;

  let bestHomePrice = 0;
  let bestLoanAmount = 0;
  let bestBreakdown: MonthlyPaymentBreakdown = {
    principalAndInterest: 0,
    propertyTax: 0,
    homeInsurance: monthlyInsurance,
    hoa,
    pmi: 0,
    totalHousingPayment: 0,
  };

  let low = 50000;
  let high = 5000000;

  for (let i = 0; i < 40; i += 1) {
    const homePrice = (low + high) / 2;
    const downPaymentAmount =
      input.downPaymentMode === "percent"
        ? homePrice * ((input.downPaymentPercent ?? 0) / 100)
        : input.downPayment;

    const loanAmount = Math.max(0, homePrice - downPaymentAmount);
    const principalAndInterest = calculateMonthlyMortgagePayment(
      loanAmount,
      input.interestRate,
      input.loanTermYears
    );
    const propertyTax = (homePrice * input.propertyTaxRate) / 12;
    const pmi = estimateMonthlyPmi(
      loanAmount,
      homePrice,
      input.creditScore,
      input.loanProgram
    );

    const totalHousingPayment =
      principalAndInterest + propertyTax + monthlyInsurance + hoa + pmi;

    if (totalHousingPayment <= maxMonthlyHousingBudget) {
      bestHomePrice = homePrice;
      bestLoanAmount = loanAmount;
      bestBreakdown = {
        principalAndInterest,
        propertyTax,
        homeInsurance: monthlyInsurance,
        hoa,
        pmi,
        totalHousingPayment,
      };
      low = homePrice;
    } else {
      high = homePrice;
    }
  }

  const actualDownPaymentAmount =
    input.downPaymentMode === "percent"
      ? bestHomePrice * ((input.downPaymentPercent ?? 0) / 100)
      : input.downPayment;

  const frontRatio = monthlyIncome > 0 ? bestBreakdown.totalHousingPayment / monthlyIncome : 0;
  const backRatio =
    monthlyIncome > 0 ? (bestBreakdown.totalHousingPayment + input.monthlyDebts) / monthlyIncome : 0;

  const scenarios = [
    input.interestRate - 1,
    input.interestRate - 0.5,
    input.interestRate,
    input.interestRate + 0.5,
    input.interestRate + 1,
  ].map((rate) => {
    const safeRate = clamp(rate, 0.1, 15);
    const pi = calculateMonthlyMortgagePayment(bestLoanAmount, safeRate, input.loanTermYears);
    return {
      interestRate: Number(safeRate.toFixed(2)),
      maxHomePrice: Math.round(bestHomePrice),
      loanAmount: Math.round(bestLoanAmount),
      monthlyPayment: Math.round(
        pi + bestBreakdown.propertyTax + bestBreakdown.homeInsurance + bestBreakdown.hoa + bestBreakdown.pmi
      ),
    };
  });

  const recommendations: string[] = [];
  if (actualDownPaymentAmount / Math.max(bestHomePrice, 1) < 0.2) {
    recommendations.push("Increase down payment to reduce PMI and monthly payment.");
  }
  if (input.monthlyDebts > 0) {
    recommendations.push("Reducing monthly debt could increase your buying power.");
  }
  if ((input.creditScore ?? 0) < 720) {
    recommendations.push("Improving credit may lower your rate and increase affordability.");
  }
  recommendations.push("Compare lender scenarios before shopping for homes.");

  return {
    maxHomePrice: Math.round(bestHomePrice),
    targetLoanAmount: Math.round(bestLoanAmount),
    maxMonthlyHousingBudget: Math.round(maxMonthlyHousingBudget),
    downPaymentAmount: Math.round(actualDownPaymentAmount),
    dti: {
      frontRatio,
      backRatio,
      frontLimit,
      backLimit,
    },
    monthlyBreakdown: {
      principalAndInterest: Math.round(bestBreakdown.principalAndInterest),
      propertyTax: Math.round(bestBreakdown.propertyTax),
      homeInsurance: Math.round(bestBreakdown.homeInsurance),
      hoa: Math.round(bestBreakdown.hoa),
      pmi: Math.round(bestBreakdown.pmi),
      totalHousingPayment: Math.round(bestBreakdown.totalHousingPayment),
    },
    scenarios,
    summary: `Based on your income, debts, down payment, and estimated housing costs, you may be able to afford a home around ${money(bestHomePrice)} with a target monthly housing payment near ${money(bestBreakdown.totalHousingPayment)}.`,
    recommendations,
  };
}
