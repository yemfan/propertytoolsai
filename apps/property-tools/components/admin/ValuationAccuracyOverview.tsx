"use client";

import { useEffect, useState } from "react";
import type { ValuationAccuracySummary } from "@/lib/valuation-tracking/types";

type AccuracyApi = {
  success: boolean;
  summary?: ValuationAccuracySummary;
  hints?: { tier34AvgErrorPct: number; lowConfidenceInsideRangePct: number };
};

export function ValuationAccuracyOverview() {
  const [data, setData] = useState<AccuracyApi | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/valuation/accuracy", { cache: "no-store" });
      const json = (await res.json()) as AccuracyApi;
      if (json?.success) setData(json);
    })();
  }, []);

  if (!data?.summary) {
    return (
      <section className="rounded-2xl border bg-white p-5 text-sm text-gray-500 shadow-sm">
        Loading valuation accuracy…
      </section>
    );
  }

  const summary = data.summary;
  const hints = data.hints;

  return (
    <section className="rounded-2xl border bg-white shadow-sm">
      <div className="border-b px-5 py-4">
        <h2 className="text-base font-semibold text-gray-900">Valuation Accuracy</h2>
      </div>
      <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Tracked Sales" value={String(summary.totalTrackedSales)} />
        <Metric label="Median Error" value={`${summary.medianErrorPct}%`} />
        <Metric label="Average Error" value={`${summary.avgErrorPct}%`} />
        <Metric label="Inside Range" value={`${summary.withinRangePct}%`} />
        <Metric label="High Confidence Median Error" value={`${summary.highConfidenceMedianErrorPct}%`} />
        <Metric label="Medium Confidence Median Error" value={`${summary.mediumConfidenceMedianErrorPct}%`} />
        <Metric label="Low Confidence Median Error" value={`${summary.lowConfidenceMedianErrorPct}%`} />
        <Metric label="Tier 3/4 Avg Error" value={`${hints?.tier34AvgErrorPct ?? 0}%`} />
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
