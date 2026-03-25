"use client";

import React, { useState } from "react";
import type { PropertySeoRecord } from "@/lib/property-seo/types";

export function PropertySeoLeadCapture({ record }: { record: PropertySeoRecord }) {
  const [done, setDone] = useState(false);

  return (
    <section className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div>
          <div className="inline-flex rounded-full border bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600">
            Get property insights
          </div>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-gray-900">
            Get a full report for {record.streetAddress}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-600 md:text-base">
            Unlock a more detailed value estimate, affordability view, and agent guidance for this
            property.
          </p>
        </div>
        <div className="rounded-2xl border bg-gray-50 p-5">
          {done ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Thanks — your request was sent.
            </div>
          ) : (
            <div className="grid gap-3">
              <input placeholder="Name" className="rounded-xl border bg-white px-4 py-3 text-sm" />
              <input placeholder="Email" className="rounded-xl border bg-white px-4 py-3 text-sm" />
              <input placeholder="Phone" className="rounded-xl border bg-white px-4 py-3 text-sm" />
              <button
                type="button"
                onClick={() => setDone(true)}
                className="rounded-2xl bg-gray-900 px-5 py-3 text-sm font-medium text-white"
              >
                Unlock Report
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
