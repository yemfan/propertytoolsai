"use client";

import Link from "next/link";
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

export function PropertySeoAffordabilityCard({ record }: { record: PropertySeoRecord }) {
  return (
    <section className="rounded-3xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">Can you afford this home?</h2>
      <div className="mt-4 space-y-2 text-sm text-gray-700">
        <div>Sample purchase price: {money(record.affordabilityExample?.purchasePrice)}</div>
        <div>Estimated monthly payment: {money(record.affordabilityExample?.estimatedMonthlyPayment)}</div>
        <div>Estimated qualifying income: {money(record.affordabilityExample?.requiredIncome)} / year</div>
      </div>
      <div className="mt-5">
        <Link
          href="/affordability"
          className="inline-block rounded-2xl bg-gray-900 px-5 py-3 text-sm font-medium text-white"
        >
          Run affordability report
        </Link>
      </div>
    </section>
  );
}
