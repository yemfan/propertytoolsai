import type { RefinanceInput, RefinanceResult } from "@repo/types";

function pmt(principal: number, annualRate: number, years: number): number {
  if (principal <= 0 || years <= 0 || annualRate <= 0) return 0;
  const r = annualRate / 100 / 12;
  const n = years * 12;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export function calculateRefinance(input: RefinanceInput): RefinanceResult {
  const paymentBefore = pmt(
    input.currentBalance,
    input.currentAnnualInterestRate,
    input.remainingTermYears
  );
  const paymentAfter = pmt(
    input.currentBalance,
    input.newAnnualInterestRate,
    input.remainingTermYears
  );

  const monthlySavings = Math.max(0, paymentBefore - paymentAfter);
  const breakEvenMonths =
    monthlySavings > 0 ? Math.max(0, Math.ceil(input.closingCosts / monthlySavings)) : 0;

  return {
    paymentBefore,
    paymentAfter,
    monthlySavings,
    breakEvenMonths,
  };
}

