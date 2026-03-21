import type { MortgageInput, MortgageResult } from "@repo/types";

function pmt(principal: number, annualRate: number, years: number): number {
  // Standard amortizing loan payment formula (principal+interest).
  // annualRate is in % (e.g. 6.5 means 6.5%).
  if (principal <= 0 || years <= 0 || annualRate <= 0) return 0;
  const r = annualRate / 100 / 12;
  const n = years * 12;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export function calculateMortgage(input: MortgageInput): MortgageResult {
  const principal = Math.max(0, input.homePrice - input.downPayment);
  const monthlyPayment = pmt(principal, input.annualInterestRate, input.loanTermYears);
  const numberOfPayments = input.loanTermYears * 12;
  const totalPayment = monthlyPayment * numberOfPayments;
  const totalInterest = Math.max(0, totalPayment - principal);

  return {
    principal,
    monthlyPayment,
    totalInterest,
    totalPayment,
  };
}

