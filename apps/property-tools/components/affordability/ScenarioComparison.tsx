"use client";

import React from "react";
import type { AffordabilityScenario } from "@/lib/affordability/types";

function money(value?: number) {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function ScenarioComparison({ scenarios }: { scenarios: AffordabilityScenario[] }) {
  return (
    <section className="rounded-3xl border bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900">Rate Sensitivity</h3>
      <div className="mt-4 space-y-3">
        {scenarios.map((scenario) => (
          <div key={scenario.interestRate} className="rounded-xl border p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="font-medium text-gray-900">{scenario.interestRate}% interest</div>
              <div className="text-sm text-gray-600">Monthly payment {money(scenario.monthlyPayment)}</div>
            </div>
            <div className="mt-2 text-sm text-gray-700">
              Max home price {money(scenario.maxHomePrice)} • Loan {money(scenario.loanAmount)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
