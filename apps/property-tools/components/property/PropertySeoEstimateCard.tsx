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

export function PropertySeoEstimateCard({ record }: { record: PropertySeoRecord }) {
  return (
    <section className="rounded-3xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">Home value estimate</h2>
      <div className="mt-4 text-3xl font-semibold tracking-tight text-gray-900">
        {money(record.estimateValue)}
      </div>
      <div className="mt-2 text-sm text-gray-600">
        Estimated range {money(record.estimateRangeLow)} – {money(record.estimateRangeHigh)}
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href="/home-value"
          className="inline-block rounded-2xl bg-gray-900 px-5 py-3 text-sm font-medium text-white"
        >
          Get full home value report
        </Link>
        <Link
          href="/home-value"
          className="inline-block rounded-2xl border px-5 py-3 text-sm font-medium text-gray-900"
        >
          Update estimate
        </Link>
      </div>
    </section>
  );
}
