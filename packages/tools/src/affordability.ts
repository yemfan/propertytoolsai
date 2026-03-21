import type { AffordabilityInput, AffordabilityResult } from "@repo/types";

function pmt(principal: number, annualRate: number, years: number): number {
  if (principal <= 0 || years <= 0 || annualRate <= 0) return 0;
  const r = annualRate / 100 / 12;
  const n = years * 12;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function principalFromPmt(monthlyPmt: number, annualRate: number, years: number): number {
  // Inverse of the amortization payment formula.
  if (monthlyPmt <= 0 || years <= 0 || annualRate <= 0) return 0;
  const r = annualRate / 100 / 12;
  const n = years * 12;
  return (monthlyPmt * (Math.pow(1 + r, n) - 1)) / (r * Math.pow(1 + r, n));
}

export function calculateAffordability(input: AffordabilityInput): AffordabilityResult {
  const dtiRatio = input.dtiRatio ?? 0.36;

  const monthlyIncome = input.annualIncome / 12;
  const maxTotalDebtPayment = dtiRatio * monthlyIncome;
  const maxHousingPayment = Math.max(0, maxTotalDebtPayment - input.monthlyDebts);

  const maxPrincipal = principalFromPmt(maxHousingPayment, input.annualInterestRate, input.loanTermYears);
  const maxHomePrice = maxPrincipal + input.downPayment;

  const principal = Math.max(0, maxHomePrice - input.downPayment);
  const estimatedMonthlyPayment = pmt(principal, input.annualInterestRate, input.loanTermYears);

  return {
    maxHomePrice: Math.max(0, maxHomePrice),
    estimatedMonthlyPayment,
  };
}

