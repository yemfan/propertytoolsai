"use client";

import React from "react";
import type { MonthlyPaymentBreakdown as Breakdown } from "@/lib/affordability/types";

function money(value?: number) {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function MonthlyPaymentBreakdown({ value }: { value: Breakdown }) {
  const rows = [
    ["Principal & Interest", value.principalAndInterest],
    ["Property Tax", value.propertyTax],
    ["Home Insurance", value.homeInsurance],
    ["HOA", value.hoa],
    ["PMI", value.pmi],
  ] as const;

  return (
    <section className="rounded-3xl border bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900">Monthly Payment Breakdown</h3>
      <div className="mt-4 space-y-3">
        {rows.map(([label, amount]) => (
          <div key={label} className="flex items-center justify-between rounded-xl border px-4 py-3">
            <span className="text-sm text-gray-700">{label}</span>
            <span className="text-sm font-semibold text-gray-900">{money(amount)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between rounded-xl bg-gray-900 px-4 py-3">
          <span className="text-sm font-medium text-white">Total Housing Payment</span>
          <span className="text-sm font-semibold text-white">{money(value.totalHousingPayment)}</span>
        </div>
      </div>
    </section>
  );
}
