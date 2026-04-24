import type { DealAnalyzerInputs } from "./types";

/**
 * Sensitivity analysis — pure math, no I/O. Re-runs the deal math
 * across several rent / rate / vacancy scenarios so the investor can
 * see at a glance where the deal breaks.
 *
 * Output is a matrix shape the UI renders as a grid.
 */

export type ScenarioAxis = "rate" | "rent" | "vacancy";

export type ScenarioCell = {
  label: string;
  monthlyCashFlow: number;
  capRate: number;
  cashOnCashReturn: number;
};

export type SensitivityTable = {
  axis: ScenarioAxis;
  axisLabel: string;
  cells: ScenarioCell[];
};

/**
 * Rent breakeven — the monthly rent that makes monthly cash flow
 * exactly zero, holding all other inputs constant. Returns null if
 * breakeven isn't reachable (rent can't be negative).
 */
export function computeRentBreakeven(
  inputs: DealAnalyzerInputs,
): number | null {
  const cf = computeMetrics(inputs).monthlyCashFlow;
  if (Math.abs(cf) < 1) return inputs.monthlyRent;

  const shift = cf;
  const breakeven = inputs.monthlyRent - shift;

  // Rent-linked expenses scale with rent, so adjust for their share.
  const variableExpenseShare =
    (inputs.maintenancePercent + inputs.managementPercent + inputs.vacancyPercent) /
    100;
  const adjusted = breakeven / (1 - variableExpenseShare);
  if (adjusted <= 0) return null;
  return adjusted;
}

/**
 * Build three sensitivity tables — rate, rent, vacancy — each with a
 * handful of cells around the base assumption. Compact enough to fit
 * in a side panel.
 */
export function buildSensitivityTables(
  inputs: DealAnalyzerInputs,
): SensitivityTable[] {
  const rate: SensitivityTable = {
    axis: "rate",
    axisLabel: "Interest rate",
    cells: [
      scenarioCell(inputs, { interestRate: inputs.interestRate - 1 }, `${(inputs.interestRate - 1).toFixed(1)}%`),
      scenarioCell(inputs, {}, `${inputs.interestRate.toFixed(1)}% (current)`),
      scenarioCell(inputs, { interestRate: inputs.interestRate + 1 }, `${(inputs.interestRate + 1).toFixed(1)}%`),
      scenarioCell(inputs, { interestRate: inputs.interestRate + 2 }, `${(inputs.interestRate + 2).toFixed(1)}%`),
    ],
  };

  const rent: SensitivityTable = {
    axis: "rent",
    axisLabel: "Monthly rent",
    cells: [
      scenarioCell(inputs, { monthlyRent: inputs.monthlyRent * 0.9 }, "−10%"),
      scenarioCell(inputs, {}, "Current"),
      scenarioCell(inputs, { monthlyRent: inputs.monthlyRent * 1.05 }, "+5%"),
      scenarioCell(inputs, { monthlyRent: inputs.monthlyRent * 1.1 }, "+10%"),
    ],
  };

  const vacancy: SensitivityTable = {
    axis: "vacancy",
    axisLabel: "Vacancy",
    cells: [
      scenarioCell(inputs, {}, `${inputs.vacancyPercent}% (current)`),
      scenarioCell(inputs, { vacancyPercent: inputs.vacancyPercent * 2 }, `${(inputs.vacancyPercent * 2).toFixed(0)}% (2×)`),
      scenarioCell(inputs, { vacancyPercent: Math.min(50, inputs.vacancyPercent * 3) }, `${Math.min(50, inputs.vacancyPercent * 3).toFixed(0)}% (3×)`),
    ],
  };

  return [rate, rent, vacancy];
}

function scenarioCell(
  base: DealAnalyzerInputs,
  override: Partial<DealAnalyzerInputs>,
  label: string,
): ScenarioCell {
  const scenario = { ...base, ...override };
  const { monthlyCashFlow, capRate, cashOnCashReturn } = computeMetrics(scenario);
  return { label, monthlyCashFlow, capRate, cashOnCashReturn };
}

/**
 * Mirror of the math in the page component, duplicated here so this
 * module stays self-contained (no import cycle into a React page).
 * Any change in the calculation should be mirrored there.
 */
export function computeMetrics(inputs: DealAnalyzerInputs) {
  const {
    purchasePrice,
    downPaymentPercent,
    interestRate,
    loanTermYears,
    monthlyRent,
    otherIncome = 0,
    propertyTaxPercent,
    insuranceMonthly,
    maintenancePercent,
    managementPercent,
    vacancyPercent,
  } = inputs;

  const downPayment = (purchasePrice * downPaymentPercent) / 100;
  const loanAmount = Math.max(purchasePrice - downPayment, 0);

  const monthlyInterestRate = interestRate > 0 ? interestRate / 100 / 12 : 0;
  const numberOfPayments = loanTermYears * 12;

  const monthlyMortgage =
    loanAmount > 0 && monthlyInterestRate > 0
      ? (loanAmount *
          monthlyInterestRate *
          Math.pow(1 + monthlyInterestRate, numberOfPayments)) /
        (Math.pow(1 + monthlyInterestRate, numberOfPayments) - 1)
      : loanAmount > 0 && numberOfPayments > 0
        ? loanAmount / numberOfPayments
        : 0;

  const grossMonthlyIncome = monthlyRent + otherIncome;
  const monthlyVacancyLoss = (grossMonthlyIncome * vacancyPercent) / 100;
  const effectiveMonthlyIncome = grossMonthlyIncome - monthlyVacancyLoss;

  const propertyTaxMonthly = (purchasePrice * propertyTaxPercent) / 100 / 12;
  const maintenanceMonthly = grossMonthlyIncome * (maintenancePercent / 100);
  const managementMonthly = grossMonthlyIncome * (managementPercent / 100);

  const operatingExpensesMonthly =
    propertyTaxMonthly + insuranceMonthly + maintenanceMonthly + managementMonthly;

  const monthlyNOI = effectiveMonthlyIncome - operatingExpensesMonthly;
  const annualNOI = monthlyNOI * 12;

  const monthlyCashFlow = effectiveMonthlyIncome - operatingExpensesMonthly - monthlyMortgage;
  const annualCashFlow = monthlyCashFlow * 12;

  const cashInvested = downPayment;
  const cashOnCashReturn = cashInvested > 0 ? (annualCashFlow / cashInvested) * 100 : 0;
  const capRate = purchasePrice > 0 ? (annualNOI / purchasePrice) * 100 : 0;
  const priceToRentRatio = monthlyRent > 0 ? purchasePrice / (monthlyRent * 12) : 0;

  return {
    loanAmount,
    monthlyMortgage,
    monthlyCashFlow,
    annualCashFlow,
    annualNOI,
    capRate,
    cashOnCashReturn,
    cashInvested,
    priceToRentRatio,
  };
}
