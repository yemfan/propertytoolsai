"use client";

import { useEffect, useState } from "react";

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

type PipelineSummary = {
  weightedPipeline: number;
  highConfidenceLeadCount: number;
  closeSoonLeadCount: number;
  avgCloseProbability: number;
};

export function PipelinePredictionPanel() {
  const [data, setData] = useState<PipelineSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/pipeline/predictions", { cache: "no-store" });
        const json = (await res.json()) as { success?: boolean; data?: PipelineSummary; error?: string };
        if (json?.success && json.data) setData(json.data);
        else setError(json?.error || "Failed to load");
      } catch {
        setError("Failed to load");
      }
    })();
  }, []);

  if (error) {
    return (
      <section className="rounded-2xl border border-red-100 bg-red-50/50 p-5 text-sm text-red-700 shadow-sm">
        {error}
      </section>
    );
  }

  if (!data) {
    return (
      <section className="rounded-2xl border bg-white p-5 text-sm text-gray-500 shadow-sm">
        Loading predicted pipeline...
      </section>
    );
  }

  return (
    <section className="rounded-2xl border bg-white shadow-sm">
      <div className="border-b px-5 py-4">
        <h2 className="text-base font-semibold text-gray-900">Predicted Pipeline</h2>
      </div>
      <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Weighted Pipeline">{money(data.weightedPipeline)}</Metric>
        <Metric label="High-Confidence Leads">{String(data.highConfidenceLeadCount)}</Metric>
        <Metric label="Likely Closing Soon">{String(data.closeSoonLeadCount)}</Metric>
        <Metric label="Avg Close Probability">{String(data.avgCloseProbability)}%</Metric>
      </div>
    </section>
  );
}

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-gray-50 p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-gray-900">{children}</div>
    </div>
  );
}
