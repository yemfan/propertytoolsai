"use client";

import React from "react";

function money(value?: number) {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function HomesInBudgetCTA({
  maxHomePrice,
  zip,
  city,
}: {
  maxHomePrice: number;
  zip?: string;
  city?: string;
}) {
  const roundedMax = Math.floor(maxHomePrice / 10000) * 10000;
  const destination = `/search?maxPrice=${roundedMax}${zip ? `&zip=${encodeURIComponent(zip)}` : city ? `&city=${encodeURIComponent(city)}` : ""}`;

  return (
    <section className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-2xl font-semibold tracking-tight text-gray-900">
            See Homes in Your Budget
          </h3>
          <p className="mt-2 text-sm text-gray-600 md:text-base">
            Browse homes up to {money(roundedMax)}
            {zip ? ` near ${zip}` : city ? ` near ${city}` : ""}.
          </p>
        </div>

        <a href={destination} className="rounded-2xl bg-gray-900 px-5 py-3 text-sm font-medium text-white">
          View Homes
        </a>
      </div>
    </section>
  );
}
