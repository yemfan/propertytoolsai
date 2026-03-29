"use client";

import React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const SLATE = ["#111827", "#374151", "#6b7280", "#9ca3af", "#d1d5db"];

function money(value?: number) {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function PaymentBreakdownChart({
  principalAndInterest,
  propertyTax,
  homeInsurance,
  hoa,
  pmi,
}: {
  principalAndInterest: number;
  propertyTax: number;
  homeInsurance: number;
  hoa: number;
  pmi: number;
}) {
  const data = [
    { name: "Principal & Interest", value: principalAndInterest },
    { name: "Property Tax", value: propertyTax },
    { name: "Insurance", value: homeInsurance },
    { name: "HOA", value: hoa },
    { name: "PMI", value: pmi },
  ].filter((x) => x.value > 0);

  if (data.length === 0) {
    return (
      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900">Payment Mix</h3>
        <p className="mt-4 text-sm text-gray-500">No payment breakdown to display.</p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900">Payment Mix</h3>
      <div className="mt-4 h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={95}
              innerRadius={28}
              paddingAngle={2}
            >
              {data.map((_, index) => (
                <Cell key={data[index].name} fill={SLATE[index % SLATE.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => money(value)} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
