"use client";

import React from "react";
import type { AffordabilityResult, BuyerIntentState } from "@/lib/affordability/types";
import { AffordabilityIntentPanel } from "./AffordabilityIntentPanel";
import { BudgetAllocationChart } from "./BudgetAllocationChart";
import { HomesInBudgetCTA } from "./HomesInBudgetCTA";
import { LenderMatchPanel } from "./LenderMatchPanel";
import { PaymentBreakdownChart } from "./PaymentBreakdownChart";
import { RateSensitivityChart } from "./RateSensitivityChart";

function money(value?: number) {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function pct(value?: number) {
  if (typeof value !== "number") return "—";
  return `${(value * 100).toFixed(1)}%`;
}

export function AffordabilityReportV2({
  annualIncome,
  monthlyDebts,
  intent,
  setIntent,
  result,
  unlocked,
  onLenderMatch,
}: {
  annualIncome: number;
  monthlyDebts: number;
  intent: BuyerIntentState;
  setIntent: React.Dispatch<React.SetStateAction<BuyerIntentState>>;
  result: AffordabilityResult | null;
  unlocked: boolean;
  onLenderMatch?: (payload: { name: string; email: string; phone: string }) => void;
}) {
  if (!result) return null;

  return (
    <div className="space-y-6">
      <AffordabilityIntentPanel
        value={intent}
        onChange={(patch) => setIntent((prev) => ({ ...prev, ...patch }))}
      />

      <section className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="text-sm font-medium text-gray-500">Estimated Buying Power</div>
            <div className="mt-2 text-4xl font-semibold tracking-tight text-gray-900 md:text-5xl">
              {money(result.maxHomePrice)}
            </div>
            <div className="mt-3 text-sm text-gray-600">
              Target loan amount {money(result.targetLoanAmount)} • Down payment{" "}
              {money(result.downPaymentAmount)}
            </div>
            <div className="mt-5 rounded-2xl bg-gray-50 p-4 text-sm leading-relaxed text-gray-700">
              {result.summary}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <Metric label="Front-End DTI" value={pct(result.dti.frontRatio)} />
            <Metric label="Back-End DTI" value={pct(result.dti.backRatio)} />
            <Metric label="Monthly Housing Budget" value={money(result.maxMonthlyHousingBudget)} />
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <PaymentBreakdownChart {...result.monthlyBreakdown} />
        <RateSensitivityChart scenarios={result.scenarios} />
        <BudgetAllocationChart
          annualIncome={annualIncome}
          monthlyDebts={monthlyDebts}
          monthlyHousingBudget={result.maxMonthlyHousingBudget}
        />
      </div>

      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900">Recommendations</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {result.recommendations.map((item) => (
            <div key={item} className="rounded-2xl border bg-gray-50 p-4 text-sm text-gray-700">
              {item}
            </div>
          ))}
        </div>
      </section>

      {unlocked ? (
        <>
          <HomesInBudgetCTA
            maxHomePrice={result.maxHomePrice}
            zip={intent.preferredZip}
            city={intent.preferredCity}
          />
          <LenderMatchPanel
            maxHomePrice={result.maxHomePrice}
            monthlyBudget={result.maxMonthlyHousingBudget}
            intent={intent}
            onSubmit={onLenderMatch}
          />
        </>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-gray-50 p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-2 text-xl font-semibold text-gray-900">{value}</div>
    </div>
  );
}
