"use client";

import React from "react";
import type { PropertySeoRecord } from "@/lib/property-seo/types";

export function PropertySeoFaq({ record }: { record: PropertySeoRecord }) {
  return (
    <section className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
      <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Frequently asked questions</h2>
      <div className="mt-5 space-y-4">
        {record.faq.map((item) => (
          <div key={item.question} className="rounded-2xl border bg-gray-50 p-4">
            <div className="font-medium text-gray-900">{item.question}</div>
            <div className="mt-2 text-sm leading-relaxed text-gray-700">{item.answer}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
