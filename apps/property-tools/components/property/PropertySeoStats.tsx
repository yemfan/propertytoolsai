"use client";

import React from "react";
import type { PropertySeoRecord } from "@/lib/property-seo/types";

function money(value?: number) {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function PropertySeoStats({ record }: { record: PropertySeoRecord }) {
  const stats = [
    { label: "Estimated Value", value: money(record.estimateValue) },
    { label: "Rent Estimate", value: money(record.rentEstimate) },
    {
      label: "Median Price / Sqft",
      value: record.medianPpsf ? `${money(record.medianPpsf)}/sqft` : "—",
    },
    { label: "Year Built", value: record.yearBuilt?.toString() || "—" },
  ];

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {stats.map((item) => (
        <div key={item.label} className="rounded-3xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">{item.label}</div>
          <div className="mt-2 text-xl font-semibold text-gray-900">{item.value}</div>
        </div>
      ))}
    </section>
  );
}
