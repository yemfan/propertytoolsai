"use client";

import { useEffect, useState } from "react";
import type { PerformanceOverview } from "@/lib/performance/types";

export function PerformanceOverviewPanel() {
  const [data, setData] = useState<PerformanceOverview | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/performance/overview", { cache: "no-store" });
      const json = await res.json();
      if (json?.success) setData(json.data as PerformanceOverview);
    })();
  }, []);

  if (!data) {
    return (
      <section className="rounded-2xl border bg-white p-5 text-sm text-gray-500 shadow-sm">
        Loading performance overview...
      </section>
    );
  }

  return (
    <section className="rounded-2xl border bg-white shadow-sm">
      <div className="border-b px-5 py-4">
        <h2 className="text-base font-semibold text-gray-900">Performance Overview</h2>
        <p className="mt-1 text-xs text-gray-500">
          Lead volume, temperature mix, conversions, revenue, and response speed.
        </p>
      </div>
      <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total Leads" value={String(data.totalLeads)} />
        <Metric label="Hot Leads" value={String(data.hotLeads)} />
        <Metric label="Conversions" value={String(data.totalConversions)} />
        <Metric label="Gross Revenue" value={formatMoney(data.grossRevenue)} />
        <Metric label="Avg Lead Score" value={String(data.avgLeadScore)} />
        <Metric label="Avg Response" value={`${data.avgResponseMinutes} min`} />
        <Metric label="Warm Leads" value={String(data.warmLeads)} />
        <Metric label="Cold Leads" value={String(data.coldLeads)} />
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}
