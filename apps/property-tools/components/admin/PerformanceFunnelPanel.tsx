"use client";

import { useEffect, useState } from "react";
import type { FunnelPerformance } from "@/lib/performance/types";

export function PerformanceFunnelPanel() {
  const [data, setData] = useState<FunnelPerformance | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/performance/funnel", { cache: "no-store" });
      const json = await res.json();
      if (json?.success) setData(json.data as FunnelPerformance);
    })();
  }, []);

  if (!data) {
    return (
      <section className="rounded-2xl border bg-white p-5 text-sm text-gray-500 shadow-sm">
        Loading funnel...
      </section>
    );
  }

  const steps = [
    { label: "Visitors", value: data.visitors },
    { label: "Leads", value: data.leads },
    { label: "Conversations", value: data.conversations },
    { label: "Appointments", value: data.appointments },
    { label: "Conversions", value: data.conversions },
  ];

  return (
    <section className="rounded-2xl border bg-white shadow-sm">
      <div className="border-b px-5 py-4">
        <h2 className="text-base font-semibold text-gray-900">Performance Funnel</h2>
        <p className="mt-1 text-xs text-gray-500">
          Visitors from tool sessions; appointments from tour-related activity when present.
        </p>
      </div>
      <div className="grid gap-4 p-5 md:grid-cols-5">
        {steps.map((step) => (
          <div key={step.label} className="rounded-xl bg-gray-50 p-4 text-center">
            <div className="text-sm text-gray-500">{step.label}</div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">{step.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
