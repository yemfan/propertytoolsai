"use client";

import { useState } from "react";

export function EnrichmentQueuePanel({ isAdmin }: { isAdmin: boolean }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ count?: number; error?: string } | null>(null);

  async function run() {
    if (!isAdmin) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/contacts/enrichment/run", { method: "POST" });
      const json = (await res.json()) as { success?: boolean; count?: number; error?: string };
      if (!res.ok || !json?.success) {
        setResult({ error: json?.error || "Enrichment failed" });
      } else {
        setResult({ count: json.count });
      }
    } catch {
      setResult({ error: "Enrichment failed" });
    } finally {
      setRunning(false);
    }
  }

  if (!isAdmin) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">Contact enrichment</h2>
        <p className="mt-1 text-xs text-slate-500">
          Infer lifecycle stage, preferred channel, and short notes summaries for recently updated leads
          (OpenAI required).
        </p>
      </div>
      <div className="space-y-3 p-5 text-sm text-slate-700">
        <button
          type="button"
          onClick={() => void run()}
          disabled={running}
          className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {running ? "Running…" : "Run enrichment batch"}
        </button>
        {result?.error ? (
          <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-red-800">{result.error}</div>
        ) : null}
        {result?.count != null ? (
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-slate-800">
            Processed: {result.count} leads
          </div>
        ) : null}
      </div>
    </section>
  );
}
