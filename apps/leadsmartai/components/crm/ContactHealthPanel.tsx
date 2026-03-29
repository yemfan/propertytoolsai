"use client";

import { useEffect, useState } from "react";

type Summary = {
  totalContacts: number;
  avgCompletenessScore: number;
  withEmailPct: number;
  withPhonePct: number;
  withBirthdayPct: number;
  withHomePurchaseDatePct: number;
};

export function ContactHealthPanel() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/contacts/summary", { cache: "no-store" });
        const json = (await res.json()) as { success?: boolean; summary?: Summary; error?: string };
        if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to load summary");
        setSummary(json.summary ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      }
    })();
  }, []);

  if (error) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm text-sm text-red-600">
        {error}
      </section>
    );
  }

  if (!summary) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm text-sm text-slate-500">
        Loading contact health…
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">Contact health</h2>
        <p className="mt-1 text-xs text-slate-500">
          Field coverage for your active leads (merged records excluded).
        </p>
      </div>
      <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
        <Metric label="Total contacts" value={String(summary.totalContacts)} />
        <Metric label="Avg completeness" value={`${summary.avgCompletenessScore}/100`} />
        <Metric label="With email" value={`${summary.withEmailPct}%`} />
        <Metric label="With phone" value={`${summary.withPhonePct}%`} />
        <Metric label="With birthday" value={`${summary.withBirthdayPct}%`} />
        <Metric label="With home purchase date" value={`${summary.withHomePurchaseDatePct}%`} />
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}
