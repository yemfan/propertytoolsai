"use client";

import React from "react";
import type { PropertySeoRecord } from "@/lib/property-seo/types";

export function PropertySeoOverview({ record }: { record: PropertySeoRecord }) {
  return (
    <section className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
      <h2 className="text-2xl font-semibold tracking-tight text-gray-900">About this home</h2>
      <p className="mt-4 text-sm leading-relaxed text-gray-700 md:text-base">{record.description}</p>
    </section>
  );
}
