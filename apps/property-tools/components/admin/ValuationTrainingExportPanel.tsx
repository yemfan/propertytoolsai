"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ValuationTrainingExportFilters } from "@/lib/valuation-training/types";

type Summary = {
  rowCount: number;
  cityCount: number;
  stateCount: number;
  propertyTypeCount: number;
  withApiEstimatePct: number;
  withCompsEstimatePct: number;
  withSqftPct: number;
};

function filtersToQueryString(f: ValuationTrainingExportFilters) {
  const qs = new URLSearchParams();
  if (f.minSaleDate) qs.set("minSaleDate", f.minSaleDate);
  if (f.maxSaleDate) qs.set("maxSaleDate", f.maxSaleDate);
  if (typeof f.minComparableCount === "number") qs.set("minComparableCount", String(f.minComparableCount));
  if (typeof f.maxErrorPct === "number") qs.set("maxErrorPct", String(f.maxErrorPct));
  if (f.requireSqft) qs.set("requireSqft", "true");
  if (f.requireApiEstimate) qs.set("requireApiEstimate", "true");
  if (f.requireCompsEstimate) qs.set("requireCompsEstimate", "true");
  return qs.toString();
}

export function ValuationTrainingExportPanel() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<"csv" | "json" | null>(null);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<ValuationTrainingExportFilters>({
    minSaleDate: "",
    maxSaleDate: "",
    requireSqft: true,
    requireApiEstimate: false,
    requireCompsEstimate: false,
    minComparableCount: 0,
  });

  const loadSummary = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const qs = filtersToQueryString(filters);
      const res = await fetch(`/api/admin/valuation/training/summary?${qs}`, { cache: "no-store" });
      const json = (await res.json()) as { success?: boolean; summary?: Summary; error?: string };
      if (!res.ok || !json.success || !json.summary) {
        setError(json.error ?? "Failed to load summary");
        setSummary(null);
        return;
      }
      setSummary(json.summary);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  async function exportCsv() {
    setExporting("csv");
    setError("");
    try {
      const exportName = `valuation_training_${new Date().toISOString().slice(0, 10)}`;
      const res = await fetch("/api/admin/valuation/training/export-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ exportName, filters }),
      });

      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Export failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${exportName}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(null);
    }
  }

  async function exportJson() {
    setExporting("json");
    setError("");
    try {
      const exportName = `valuation_training_${new Date().toISOString().slice(0, 10)}`;
      const res = await fetch("/api/admin/valuation/training/export-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ exportName, filters }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string; rows?: unknown[] };
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Export failed");
      }
      const blob = new Blob([JSON.stringify(json.rows, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${exportName}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(null);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-4">
        <h2 className="text-base font-semibold text-gray-900">Valuation training export</h2>
        <p className="mt-1 text-xs text-gray-500">
          Labeled rows from <code className="rounded bg-gray-100 px-1">valuation_runs</code> with known sale
          price. See also{" "}
          <Link href="/admin/platform-overview" className="font-medium text-gray-900 underline">
            valuation accuracy
          </Link>
          .
        </p>
      </div>

      <div className="space-y-5 p-5">
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Min sale date</label>
            <input
              type="date"
              value={filters.minSaleDate ?? ""}
              onChange={(e) => setFilters((prev) => ({ ...prev, minSaleDate: e.target.value || undefined }))}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Max sale date</label>
            <input
              type="date"
              value={filters.maxSaleDate ?? ""}
              onChange={(e) => setFilters((prev) => ({ ...prev, maxSaleDate: e.target.value || undefined }))}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Min comparable count</label>
            <input
              type="number"
              min={0}
              value={filters.minComparableCount ?? 0}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, minComparableCount: Number(e.target.value) }))
              }
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void loadSummary()}
              disabled={loading}
              className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? "Refreshing…" : "Refresh summary"}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-gray-700">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!filters.requireSqft}
              onChange={(e) => setFilters((prev) => ({ ...prev, requireSqft: e.target.checked }))}
            />
            Require sqft
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!filters.requireApiEstimate}
              onChange={(e) => setFilters((prev) => ({ ...prev, requireApiEstimate: e.target.checked }))}
            />
            Require API estimate
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!filters.requireCompsEstimate}
              onChange={(e) => setFilters((prev) => ({ ...prev, requireCompsEstimate: e.target.checked }))}
            />
            Require comps estimate
          </label>
        </div>

        {summary ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Metric label="Rows" value={String(summary.rowCount)} />
            <Metric label="Cities" value={String(summary.cityCount)} />
            <Metric label="States" value={String(summary.stateCount)} />
            <Metric label="With API estimate" value={`${summary.withApiEstimatePct}%`} />
            <Metric label="With comps estimate" value={`${summary.withCompsEstimatePct}%`} />
            <Metric label="With sqft" value={`${summary.withSqftPct}%`} />
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void exportCsv()}
            disabled={exporting !== null}
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:bg-gray-300"
          >
            {exporting === "csv" ? "Exporting…" : "Export CSV"}
          </button>
          <button
            type="button"
            onClick={() => void exportJson()}
            disabled={exporting !== null}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50"
          >
            {exporting === "json" ? "Exporting…" : "Export JSON"}
          </button>
        </div>
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
