/**
 * Deterministic financial calculations for a Financial Needs Analysis (FNA).
 *
 * These run server-side BEFORE the LLM is invoked, so the report contains
 * trustworthy numbers and the LLM only handles narrative. The LLM is
 * instructed not to recompute these — it cites them as given.
 *
 * Methodology mirrors common producer playbooks:
 *  - Income replacement: 10× household annual income (a widely-used rule-of-thumb)
 *  - DIME: Debt + (Income × years_to_replace) + Mortgage + Education
 *  - Coverage gap: need − existing coverage
 *  - Retirement shortfall: need at retirement − projected savings at retirement
 *  - Recommended coverage: max(income replacement, DIME) − existing, rounded up to nearest $50k
 *
 * NOT a substitute for a licensed producer's suitability determination.
 */

export type FnaCalcInput = {
  age?: number | null;
  annualIncome?: number | null;
  spouseIncome?: number | null;
  dependents?: number | null;
  outstandingDebts?: number | null;
  mortgageBalance?: number | null;
  currentSavings?: number | null;
  current401k?: number | null;
  retirementAge?: number | null;
  monthlyExpenses?: number | null;
  existingCoverage?: number | null;
};

export type FnaCalcOutput = {
  /** Annual household income (income + spouse income). */
  householdIncome: number;
  /** Income × 10 — the most common simple income-replacement target. */
  incomeReplacementNeed: number;
  /** Debt + (Income × yearsToReplace) + Mortgage + Education. */
  dimeNumber: number;
  /** max(incomeReplacementNeed, dimeNumber) − existingCoverage, floored at 0. */
  coverageGap: number;
  /** Coverage gap rounded up to nearest $50k, capped at $5M for sanity. */
  recommendedCoverage: number;
  /** Annual retirement income need (80% of current monthly expenses × 12). */
  retirementAnnualNeed: number;
  /** Lump sum needed at retirement to fund annualNeed for 25 years at 4% withdrawal. */
  retirementLumpSumNeed: number;
  /** Projected 401k balance at retirement assuming 6% growth, no further contributions. */
  retirementProjectedSavings: number;
  /** retirementLumpSumNeed − retirementProjectedSavings, floored at 0. */
  retirementShortfall: number;
  /** Years to retirement (or 0 if past). */
  yearsToRetirement: number;
};

const EDUCATION_PER_CHILD = 100000; // rough public-university 4yr estimate

function n(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function roundUpTo(value: number, step: number): number {
  if (value <= 0) return 0;
  return Math.ceil(value / step) * step;
}

export function computeFna(input: FnaCalcInput): FnaCalcOutput {
  const age = n(input.age);
  const retirementAge = n(input.retirementAge) || 65;
  const yearsToRetirement = Math.max(0, retirementAge - age);

  const householdIncome = n(input.annualIncome) + n(input.spouseIncome);
  const dependents = n(input.dependents);
  const debts = n(input.outstandingDebts);
  const mortgage = n(input.mortgageBalance);
  const existingCoverage = n(input.existingCoverage);
  const current401k = n(input.current401k);
  const monthlyExpenses = n(input.monthlyExpenses);

  // 10× income — widely-used producer rule-of-thumb. Documented in compliance footer.
  const incomeReplacementNeed = householdIncome * 10;

  // DIME — Debt + (Income × 10) + Mortgage + Education for each dependent
  const yearsToReplace = 10;
  const dimeNumber =
    debts +
    householdIncome * yearsToReplace +
    mortgage +
    dependents * EDUCATION_PER_CHILD;

  const grossNeed = Math.max(incomeReplacementNeed, dimeNumber);
  const coverageGap = Math.max(0, grossNeed - existingCoverage);
  const recommendedCoverage = Math.min(5_000_000, roundUpTo(coverageGap, 50_000));

  // Retirement: assume 80% of current expenses for 25 years at 4% safe withdrawal
  const retirementAnnualNeed = Math.max(0, monthlyExpenses * 12 * 0.8);
  const retirementLumpSumNeed = retirementAnnualNeed * 25;

  // Projected savings: grow 401k at 6% for yearsToRetirement, no new contributions
  const growthFactor = Math.pow(1.06, yearsToRetirement);
  const retirementProjectedSavings = current401k * growthFactor;
  const retirementShortfall = Math.max(
    0,
    retirementLumpSumNeed - retirementProjectedSavings
  );

  return {
    householdIncome,
    incomeReplacementNeed,
    dimeNumber,
    coverageGap,
    recommendedCoverage,
    retirementAnnualNeed,
    retirementLumpSumNeed,
    retirementProjectedSavings,
    retirementShortfall,
    yearsToRetirement,
  };
}
