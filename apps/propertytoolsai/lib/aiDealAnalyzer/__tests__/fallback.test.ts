import { describe, expect, it } from "vitest";
import { buildFallbackCommentary } from "../fallback";
import type { DealAnalyzerInputs, DealAnalyzerMetrics } from "../types";

function inputs(o: Partial<DealAnalyzerInputs> = {}): DealAnalyzerInputs {
  return {
    propertyAddress: "123 Test St",
    purchasePrice: 350_000,
    downPaymentPercent: 20,
    interestRate: 6.5,
    loanTermYears: 30,
    monthlyRent: 2500,
    otherIncome: 0,
    propertyTaxPercent: 1.2,
    insuranceMonthly: 150,
    maintenancePercent: 8,
    managementPercent: 8,
    vacancyPercent: 5,
    ...o,
  };
}

function metrics(o: Partial<DealAnalyzerMetrics> = {}): DealAnalyzerMetrics {
  return {
    loanAmount: 280_000,
    monthlyMortgage: 1770,
    monthlyCashFlow: 200,
    annualCashFlow: 2400,
    annualNOI: 23_760,
    capRate: 6.8,
    cashOnCashReturn: 3.4,
    cashInvested: 70_000,
    priceToRentRatio: 11.7,
    ...o,
  };
}

describe("buildFallbackCommentary", () => {
  it("marks aiGenerated:false so the caller can show the offline badge", () => {
    const out = buildFallbackCommentary(inputs(), metrics());
    expect(out.aiGenerated).toBe(false);
  });

  it("clamps deal score to 0-100", () => {
    const ok = buildFallbackCommentary(inputs(), metrics());
    expect(ok.dealScore).toBeGreaterThanOrEqual(0);
    expect(ok.dealScore).toBeLessThanOrEqual(100);

    const crazy = buildFallbackCommentary(
      inputs(),
      metrics({ monthlyCashFlow: 999_999, capRate: 40, cashOnCashReturn: 200 }),
    );
    expect(crazy.dealScore).toBeLessThanOrEqual(100);
  });

  it("gives a strong headline for a clearly good deal", () => {
    const out = buildFallbackCommentary(
      inputs({ purchasePrice: 200_000, monthlyRent: 3000 }),
      metrics({
        monthlyCashFlow: 700,
        capRate: 10,
        cashOnCashReturn: 15,
        priceToRentRatio: 5.5,
      }),
    );
    expect(out.dealScore).toBeGreaterThan(60);
    expect(out.headline.toLowerCase()).toMatch(/strong|solid/);
  });

  it("flags negative cash flow in risks + adds a fix as a next move", () => {
    const out = buildFallbackCommentary(
      inputs(),
      metrics({ monthlyCashFlow: -400 }),
    );
    expect(out.risks.join(" ").toLowerCase()).toContain("negative cash flow");
    expect(out.nextMoves.join(" ").toLowerCase()).toMatch(
      /negotiate|down payment|rent/,
    );
  });

  it("always returns at least one strength, one risk, and one next move", () => {
    const out = buildFallbackCommentary(
      inputs(),
      metrics({
        monthlyCashFlow: 0,
        capRate: 5,
        cashOnCashReturn: 5,
        priceToRentRatio: 20,
      }),
    );
    expect(out.strengths.length).toBeGreaterThan(0);
    expect(out.risks.length).toBeGreaterThan(0);
    expect(out.nextMoves.length).toBeGreaterThan(0);
  });

  it("caps each list at 3 items", () => {
    const out = buildFallbackCommentary(inputs(), metrics());
    expect(out.strengths.length).toBeLessThanOrEqual(3);
    expect(out.risks.length).toBeLessThanOrEqual(3);
    expect(out.nextMoves.length).toBeLessThanOrEqual(3);
  });
});
