"use client";

import { useState } from "react";

type Candidate = {
  primaryLeadId: string;
  duplicateLeadId: string;
  confidenceScore: number;
  reasons?: { detail: string }[];
};

export function DuplicateReviewPanel({ isAdmin }: { isAdmin: boolean }) {
  const [rows, setRows] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function scan() {
    if (!isAdmin) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/contacts/cleanup/scan", { method: "POST" });
      const json = (await res.json()) as { success?: boolean; candidates?: Candidate[]; error?: string };
      if (!res.ok || !json?.success) throw new Error(json?.error || "Scan failed");
      setRows(json.candidates || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  }

  async function merge(primaryLeadId: string, duplicateLeadId: string) {
    if (!isAdmin) return;
    setError("");
    try {
      const res = await fetch("/api/admin/contacts/cleanup/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryLeadId, duplicateLeadId }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json?.success) throw new Error(json?.error || "Merge failed");
      setRows((prev) =>
        prev.filter((x) => !(x.primaryLeadId === primaryLeadId && x.duplicateLeadId === duplicateLeadId))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Merge failed");
    }
  }

  if (!isAdmin) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">Duplicate review</h2>
        <button
          type="button"
          onClick={() => void scan()}
          disabled={loading}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? "Scanning…" : "Scan duplicates"}
        </button>
      </div>
      <div className="space-y-3 p-5">
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
        {rows.length ? (
          rows.map((row) => (
            <div key={`${row.primaryLeadId}-${row.duplicateLeadId}`} className="rounded-xl border border-slate-100 p-4 text-sm">
              <div className="font-medium text-slate-900">
                Primary #{row.primaryLeadId} ↔ Duplicate #{row.duplicateLeadId}
              </div>
              <div className="mt-1 text-slate-600">Confidence: {row.confidenceScore}</div>
              <div className="mt-2 text-xs text-slate-500">
                {(row.reasons || []).map((r) => r.detail).join(" • ")}
              </div>
              <button
                type="button"
                onClick={() => void merge(row.primaryLeadId, row.duplicateLeadId)}
                className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
              >
                Merge into primary
              </button>
            </div>
          ))
        ) : (
          <div className="text-sm text-slate-500">No duplicate candidates loaded. Run a scan to populate.</div>
        )}
      </div>
    </section>
  );
}
