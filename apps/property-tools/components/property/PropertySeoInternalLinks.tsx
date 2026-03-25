"use client";

import React from "react";
import type { PropertySeoRecord } from "@/lib/property-seo/types";

export function PropertySeoInternalLinks({ record }: { record: PropertySeoRecord }) {
  return (
    <section className="rounded-3xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">Explore more</h2>
      <div className="mt-4 flex flex-wrap gap-3">
        {record.neighborhoodLinks.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="rounded-full border bg-gray-50 px-4 py-2 text-sm font-medium text-gray-900"
          >
            {item.label}
          </a>
        ))}
      </div>
    </section>
  );
}
