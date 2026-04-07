"use client";

import { useCallback, useState } from "react";
import Link from "next/link";

type Row = {
  id: string;
  address: string;
  price: string;
  sqft: string;
  beds: string;
  baths: string;
  rent: string;
};

function newRow(): Row {
  return {
    id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    address: "",
    price: "",
    sqft: "",
    beds: "3",
    baths: "2",
    rent: "",
  };
}

export default function ComparisonReportBuilderClient({
  planType,
}: {
  planType: string;
}) {
  const [clientName, setClientName] = useState("");
  const [rows, setRows] = useState<Row[]>(() => [newRow(), newRow()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const isFree = planType.toLowerCase() === "free";

  const updateRow = useCallback((id: string, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, newRow()]);
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows((prev) => (prev.length <= 2 ? prev : prev.filter((r) => r.id !== id)));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setShareUrl(null);
    if (isFree) {
      setError("Upgrade to Pro or Premium to generate AI comparison reports.");
      return;
    }

    const properties = rows.map((r) => ({
      id: r.id,
      address: r.address.trim(),
      price: Number(r.price),
      beds: Number(r.beds),
      baths: Number(r.baths),
      sqft: Number(r.sqft),
      rentMonthly: r.rent.trim() === "" ? null : Number(r.rent),
    }));

    setLoading(true);
    try {
      const res = await fetch("/api/comparison-reports", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: clientName.trim() || "Client",
          properties,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error ?? json.message ?? "Request failed");
      }
      const path = json.share_url as string;
      if (typeof window !== "undefined" && path) {
        setShareUrl(`${window.location.origin}${path}`);
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to create report");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">AI Property Comparison Report</h1>
        <p className="mt-2 text-gray-600">
          Build a client-ready comparison with executive summary, scores, and AI insights. Share a public link or
          download a PDF.
        </p>
        {isFree ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            This feature requires <strong>Pro</strong> or <strong>Premium</strong>.{" "}
            <Link href="/agent/pricing" className="font-semibold underline">
              View plans
            </Link>
          </div>
        ) : null}
      </div>

      <form onSubmit={onSubmit} className="space-y-8">
        <div>
          <label className="block text-sm font-medium text-gray-700">Client name</label>
          <input
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="mt-1 w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="e.g. Jane Smith"
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Properties (min. 2)</h2>
            <button
              type="button"
              onClick={addRow}
              className="text-sm font-semibold text-[#0066b3] hover:underline"
            >
              + Add property
            </button>
          </div>

          {rows.map((row, idx) => (
            <div key={row.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-800">Property {idx + 1}</span>
                {rows.length > 2 ? (
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    className="rounded-lg border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="sm:col-span-2 lg:col-span-3">
                  <span className="text-xs text-gray-500">Address</span>
                  <input
                    required
                    value={row.address}
                    onChange={(e) => updateRow(row.id, { address: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    placeholder="123 Main St, City, ST"
                  />
                </label>
                <label>
                  <span className="text-xs text-gray-500">Price ($)</span>
                  <input
                    required
                    type="number"
                    min={1}
                    value={row.price}
                    onChange={(e) => updateRow(row.id, { price: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
                <label>
                  <span className="text-xs text-gray-500">Sqft</span>
                  <input
                    required
                    type="number"
                    min={1}
                    value={row.sqft}
                    onChange={(e) => updateRow(row.id, { sqft: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
                <label>
                  <span className="text-xs text-gray-500">Beds</span>
                  <input
                    type="number"
                    min={0}
                    value={row.beds}
                    onChange={(e) => updateRow(row.id, { beds: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
                <label>
                  <span className="text-xs text-gray-500">Baths</span>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={row.baths}
                    onChange={(e) => updateRow(row.id, { baths: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
                <label>
                  <span className="text-xs text-gray-500">Monthly rent ($) — optional</span>
                  <input
                    type="number"
                    min={0}
                    value={row.rent}
                    onChange={(e) => updateRow(row.id, { rent: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>

        {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

        {shareUrl ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <p className="font-semibold">Report created</p>
            <p className="mt-2 break-all">
              Share link:{" "}
              <a href={shareUrl} className="text-[#0066b3] underline" target="_blank" rel="noreferrer">
                {shareUrl}
              </a>
            </p>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading || isFree}
          className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Generating report…" : "Generate report & AI content"}
        </button>
      </form>
    </div>
  );
}
