"use client";

import React, { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AffordabilityResult } from "@/lib/affordability/types";

function money(value?: number) {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function RateSensitivityChart({
  scenarios,
}: {
  scenarios: AffordabilityResult["scenarios"];
}) {
  const data = useMemo(
    () => [...scenarios].sort((a, b) => a.interestRate - b.interestRate),
    [scenarios]
  );

  if (!data.length) {
    return (
      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900">Rate Sensitivity</h3>
        <p className="mt-4 text-sm text-gray-500">No rate scenarios yet.</p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900">Rate Sensitivity</h3>
      <p className="mt-1 text-xs text-gray-500">Max home price by interest rate (scenario)</p>
      <div className="mt-4 h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="interestRate" tick={{ fontSize: 12 }} unit="%" />
            <YAxis tickFormatter={(value) => `$${Math.round(value / 1000)}k`} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value: number) => money(value)} labelFormatter={(l) => `${l}% rate`} />
            <Line
              type="monotone"
              dataKey="maxHomePrice"
              name="Max home price"
              stroke="#111827"
              strokeWidth={2}
              dot={{ r: 4, fill: "#111827" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
