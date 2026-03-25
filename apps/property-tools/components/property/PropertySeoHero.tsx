"use client";

import React, { useState } from "react";
import type { PropertySeoRecord } from "@/lib/property-seo/types";

function money(value?: number) {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function PropertySeoHero({ record }: { record: PropertySeoRecord }) {
  const [selected, setSelected] = useState(0);
  const photos = record.photos || [];
  const primary = photos[selected] || photos[0];

  return (
    <section className="space-y-6">
      <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="grid gap-2 p-2 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="overflow-hidden rounded-3xl bg-gray-100">
            {primary ? (
              <img
                src={primary.url}
                alt={primary.alt || record.fullAddress}
                className="h-[440px] w-full object-cover"
              />
            ) : (
              <div className="flex h-[440px] items-center justify-center text-sm text-gray-500">
                No photos available
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {photos.slice(0, 4).map((photo, index) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setSelected(index)}
                className="overflow-hidden rounded-2xl border bg-gray-100"
              >
                <img
                  src={photo.url}
                  alt={photo.alt || `${record.fullAddress} ${index + 1}`}
                  className="h-[215px] w-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900 md:text-4xl">
              {record.fullAddress}
            </h1>
            <p className="mt-2 text-sm text-gray-600 md:text-base">
              {record.city}, {record.state} {record.zip}
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-sm text-gray-700">
              <span className="rounded-full border bg-gray-50 px-3 py-1.5">{record.beds ?? "—"} bd</span>
              <span className="rounded-full border bg-gray-50 px-3 py-1.5">{record.baths ?? "—"} ba</span>
              <span className="rounded-full border bg-gray-50 px-3 py-1.5">
                {record.sqft?.toLocaleString() || "—"} sqft
              </span>
              <span className="rounded-full border bg-gray-50 px-3 py-1.5 capitalize">
                {record.propertyType?.replaceAll("_", " ") || "Home"}
              </span>
            </div>
          </div>

          <div className="rounded-3xl border bg-gray-50 p-5 xl:min-w-[320px]">
            <div className="text-sm text-gray-500">Estimated value</div>
            <div className="mt-2 text-4xl font-semibold tracking-tight text-gray-900">
              {money(record.estimateValue)}
            </div>
            <div className="mt-2 text-sm text-gray-600">
              Range {money(record.estimateRangeLow)} – {money(record.estimateRangeHigh)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
