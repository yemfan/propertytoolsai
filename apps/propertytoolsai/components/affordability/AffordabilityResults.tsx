"use client";

import React from "react";
import type { AffordabilityResult } from "@/lib/affordability/types";
import { MonthlyPaymentBreakdown } from "./MonthlyPaymentBreakdown";
import { ScenarioComparison } from "./ScenarioComparison";

function money(value?: number) {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function AffordabilityResults({ value }: { value: AffordabilityResult }) {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <div>
            <div className="text-sm font-medium text-gray-500">Estimated Buying Power</div>
            <div className="mt-2 text-4xl font-semibold tracking-tight text-gray-900 md:text-5xl">
              {money(value.maxHomePrice)}
            </div>
            <div className="mt-3 text-sm text-gray-600">
              Target loan amount {money(value.targetLoanAmount)} • Monthly housing budget{" "}
              {money(value.maxMonthlyHousingBudget)}
            </div>
            <div className="mt-5 rounded-2xl bg-gray-50 p-4 text-sm leading-relaxed text-gray-700">
              {value.summary}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <Metric label="Down Payment" value={money(value.downPaymentAmount)} />
            <Metric label="Front-End DTI" value={`${(value.dti.frontRatio * 100).toFixed(1)}%`} />
            <Metric label="Back-End DTI" value={`${(value.dti.backRatio * 100).toFixed(1)}%`} />
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <MonthlyPaymentBreakdown value={value.monthlyBreakdown} />
        <ScenarioComparison scenarios={value.scenarios} />
      </div>

      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900">Recommendations</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {value.recommendations.map((item) => (
            <div key={item} className="rounded-2xl border bg-gray-50 p-4 text-sm text-gray-700">
              {item}
            </div>
          ))}
        </div>
      </section>
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
