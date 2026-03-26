"use client";

import React from "react";
import type { PropertySeoRecord } from "@/lib/property-seo/types";

function money(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value === 0) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function PropertySeoCompsPreview({ record }: { record: PropertySeoRecord }) {
  return (
    <section className="rounded-3xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">Nearby comparable sales</h2>
      <div className="mt-4 space-y-3">
        {record.comps.map((comp) => (
          <div key={comp.id} className="rounded-2xl border bg-gray-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium text-gray-900">{comp.address}</div>
                <div className="mt-1 text-sm text-gray-600">
                  Sold {new Date(comp.soldDate).toLocaleDateString()}
                </div>
              </div>
              <div className="text-right font-semibold text-gray-900">{money(comp.soldPrice)}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
