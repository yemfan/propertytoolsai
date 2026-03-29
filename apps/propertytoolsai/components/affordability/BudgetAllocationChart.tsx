"use client";

import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function money(value?: number) {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function BudgetAllocationChart({
  annualIncome,
  monthlyDebts,
  monthlyHousingBudget,
}: {
  annualIncome: number;
  monthlyDebts: number;
  monthlyHousingBudget: number;
}) {
  const monthlyIncome = annualIncome / 12;
  const remainder = Math.max(0, monthlyIncome - monthlyDebts - monthlyHousingBudget);
  const data = [
    { name: "Debts", value: monthlyDebts },
    { name: "Housing Budget", value: monthlyHousingBudget },
    { name: "Other Remaining Income", value: remainder },
  ];

  return (
    <section className="rounded-3xl border bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900">Monthly Budget Allocation</h3>
      <div className="mt-4 h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-12} textAnchor="end" height={56} />
            <YAxis tickFormatter={(value) => `$${Math.round(value)}`} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value: number) => money(value)} />
            <Bar dataKey="value" fill="#111827" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
