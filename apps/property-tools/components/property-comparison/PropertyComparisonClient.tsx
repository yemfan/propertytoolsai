"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAccess } from "@/components/AccessProvider";
import ExpertCTA from "@/components/ExpertCTA";
import { readAndClearComparisonPrefill } from "@/lib/cmaComparisonPrefill";
import { evaluateConversionOutreach } from "@/lib/conversionOutreachClient";
import { trackComparisonStarted } from "@/lib/tracking";
import { calculatePropertyScore, type PropertyInput } from "@/lib/propertyScoring";

function newId() {
  return `prop_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function emptyRow(): PropertyInput {
  return {
    id: newId(),
    address: "",
    price: 0,
    beds: 3,
    baths: 2,
    sqft: 1500,
    rentMonthly: null,
  };
}

function fmtMoney(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

type AiPayload = {
  bestPropertyId: string;
  explanation: string;
  pros: string[];
  cons: string[];
} | null;

export default function PropertyComparisonClient() {
  const searchParams = useSearchParams();
  const spKey = searchParams.toString();

  const { tier, openPaywall, openAuth, loading: accessLoading } = useAccess();
  const premium = tier === "premium";
  const maxRows = premium ? 8 : 1;

  const [rows, setRows] = useState<PropertyInput[]>(() => [emptyRow()]);
  const [aiResult, setAiResult] = useState<AiPayload>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [fromCmaHint, setFromCmaHint] = useState(false);
  const comparisonStartedTracked = useRef(false);

  useEffect(() => {
    if (searchParams.get("from") !== "cma") return;
    const pref = readAndClearComparisonPrefill();
    if (pref?.rows?.length) {
      setRows(pref.rows);
      setAiResult(null);
      setAiError(null);
      setFromCmaHint(true);
    }
  }, [spKey, searchParams]);

  useEffect(() => {
    const complete = rows.filter((r) => r.address.trim() && r.price > 0 && r.sqft > 0);
    if (complete.length < 2 || comparisonStartedTracked.current) return;
    comparisonStartedTracked.current = true;
    void trackComparisonStarted({
      row_count: rows.length,
      complete_count: complete.length,
      sample_address: complete[0]?.address ?? "",
    });
  }, [rows]);

  const scored = useMemo(() => {
    return rows
      .filter((r) => r.address.trim() && r.price > 0 && r.sqft > 0)
      .map((p) => ({ property: p, score: calculatePropertyScore(p) }));
  }, [rows]);

  const bestId = useMemo(() => {
    if (!scored.length) return null;
    let best = scored[0];
    for (const s of scored) {
      if (s.score.total > best.score.total) best = s;
    }
    return best.property.id;
  }, [scored]);

  const updateRow = useCallback((id: string, patch: Partial<PropertyInput>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setAiResult(null);
  }, []);

  const addRow = useCallback(() => {
    if (!premium && rows.length >= 1) {
      openPaywall(
        "AI Property Comparison is a Premium feature. Upgrade to add multiple properties and unlock AI ranking."
      );
      return;
    }
    if (rows.length >= maxRows) return;
    setRows((prev) => [...prev, emptyRow()]);
    setAiResult(null);
  }, [premium, rows.length, maxRows, openPaywall]);

  const removeRow = useCallback(
    (id: string) => {
      if (rows.length <= 1) return;
      setRows((prev) => prev.filter((r) => r.id !== id));
      setAiResult(null);
    },
    [rows.length]
  );

  async function runAi() {
    setAiError(null);
    if (!premium) {
      openPaywall("Sign up for Premium to generate AI rankings and explanations.");
      return;
    }
    const valid = rows.filter((r) => r.address.trim() && r.price > 0 && r.sqft > 0);
    if (valid.length < 2) {
      setAiError("Enter at least two complete properties (address, price, sqft).");
      return;
    }

    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/property-comparison", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ properties: valid }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 401) {
        openAuth("login");
        setAiError("Please sign in to run AI comparison.");
        return;
      }
      if (res.status === 402) {
        openPaywall(json.message ?? "Premium required.");
        return;
      }
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "Request failed");
      }
      setAiResult(json.ai as AiPayload);
      void evaluateConversionOutreach();
    } catch (e: any) {
      setAiError(e?.message ?? "AI request failed.");
    } finally {
      setAiLoading(false);
    }
  }

  const highlightId = aiResult?.bestPropertyId ?? bestId;

  const inputClass =
    "w-full rounded border border-gray-300 p-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="w-full max-w-6xl py-10">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-blue-600"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Home
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {fromCmaHint ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <span>
                <span className="font-semibold">Loaded from your CMA.</span> Review the rows below, add or edit
                properties, then run AI insight (Premium).
              </span>
              <button
                type="button"
                className="text-xs font-semibold text-emerald-800 underline hover:no-underline"
                onClick={() => setFromCmaHint(false)}
              >
                Dismiss
              </button>
            </div>
          ) : null}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="mb-2 text-3xl font-bold text-blue-600">AI Property Comparison</h1>
              <p className="text-gray-600">
                Add investment candidates, compare metrics side-by-side, and get an AI recommendation.
                {!premium && (
                  <span className="font-semibold text-amber-800">
                    {" "}
                    Free accounts can enter one property; Premium unlocks multi-property compare + AI.
                  </span>
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={addRow}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50"
              >
                + Add property
              </button>
              <button
                type="button"
                disabled={aiLoading || accessLoading}
                onClick={runAi}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {aiLoading ? "Generating…" : "Generate AI insight"}
              </button>
            </div>
          </div>

          <section className="space-y-4">
            {rows.map((row, idx) => (
              <div key={row.id} className="rounded-lg bg-white p-6 shadow-md">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-900">Property {idx + 1}</span>
                  {rows.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      className="text-xs font-semibold text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="block sm:col-span-2 lg:col-span-3">
                    <span className="mb-1 block text-xs font-medium text-gray-700">Address</span>
                    <input
                      value={row.address}
                      onChange={(e) => updateRow(row.id, { address: e.target.value })}
                      className={inputClass}
                      placeholder="123 Main St, Los Angeles, CA 90001"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-700">Price ($)</span>
                    <input
                      type="number"
                      min={0}
                      value={row.price || ""}
                      onChange={(e) => updateRow(row.id, { price: Number(e.target.value) })}
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-700">Sqft</span>
                    <input
                      type="number"
                      min={1}
                      value={row.sqft || ""}
                      onChange={(e) => updateRow(row.id, { sqft: Number(e.target.value) })}
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-700">Beds</span>
                    <input
                      type="number"
                      min={0}
                      value={row.beds}
                      onChange={(e) => updateRow(row.id, { beds: Number(e.target.value) })}
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-700">Baths</span>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={row.baths}
                      onChange={(e) => updateRow(row.id, { baths: Number(e.target.value) })}
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-700">
                      Monthly rent ($) <span className="text-gray-400">optional</span>
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={row.rentMonthly ?? ""}
                      onChange={(e) =>
                        updateRow(row.id, {
                          rentMonthly: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      className={inputClass}
                      placeholder="For yield / ROI"
                    />
                  </label>
                </div>
              </div>
            ))}
          </section>

          {scored.length > 0 ? (
            <div className="overflow-x-auto rounded-lg bg-white shadow-md">
              <table className="min-w-full text-left text-sm text-gray-800">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 font-semibold text-gray-700">Property</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">Price</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">$/sqft</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">Est. ROI / yr</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">Investment score</th>
                  </tr>
                </thead>
                <tbody>
                  {scored.map(({ property: p, score }) => {
                    const isBest = p.id === highlightId;
                    return (
                      <tr
                        key={p.id}
                        className={
                          isBest
                            ? "border-l-4 border-l-emerald-500 bg-emerald-50/70"
                            : "border-b border-gray-100"
                        }
                      >
                        <td className="max-w-[220px] px-4 py-3">
                          <div className="truncate font-medium" title={p.address}>
                            {p.address || "—"}
                          </div>
                          {isBest ? (
                            <span className="mt-1 inline-block rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                              Top pick
                            </span>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">{fmtMoney(p.price)}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {fmtMoney(score.metrics.pricePerSqft)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {score.metrics.estimatedAnnualRoiPct != null
                            ? `${score.metrics.estimatedAnnualRoiPct.toFixed(2)}%`
                            : "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-gray-900">
                          {score.total}
                          <span className="text-xs font-normal text-gray-500"> /100</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Enter address, price, and sqft to see the comparison table.</p>
          )}

          {aiError ? (
            <p className="text-sm font-medium text-red-600">{aiError}</p>
          ) : null}
        </div>

        <aside className="h-fit space-y-4 lg:sticky lg:top-24">
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="text-lg font-semibold text-gray-900">How scoring works</h2>
            <ul className="mt-3 space-y-2 text-xs text-gray-600">
              <li>
                <span className="font-semibold text-gray-800">Financial (40%)</span> — $/sqft & rent yield
              </li>
              <li>
                <span className="font-semibold text-gray-800">Location (30%)</span> — market tier heuristic
              </li>
              <li>
                <span className="font-semibold text-gray-800">Property (20%)</span> — size & bed/bath fit
              </li>
              <li>
                <span className="font-semibold text-gray-800">Market (10%)</span> — momentum proxy
              </li>
            </ul>
          </div>

          <div className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="text-lg font-semibold text-gray-900">AI recommendation</h2>
            {!aiResult ? (
              <p className="mt-2 text-sm text-gray-600">
                {premium
                  ? "Add two or more properties and click “Generate AI insight” for a ranked recommendation."
                  : "Upgrade to Premium to unlock AI ranking, pros/cons, and multi-property compare."}
              </p>
            ) : (
              <div className="mt-3 space-y-3 text-sm text-gray-700">
                <p>{aiResult.explanation}</p>
                <div>
                  <div className="text-xs font-semibold uppercase text-emerald-700">Pros</div>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {aiResult.pros.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase text-amber-800">Cons</div>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {aiResult.cons.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          <ExpertCTA
            subjectProperty={rows[0] ?? emptyRow()}
            comparisonRows={rows}
            aiRecommendation={aiResult}
          />

          {!premium ? (
            <button
              type="button"
              onClick={() => openPaywall()}
              className="w-full rounded-lg bg-orange-500 py-3 text-sm font-semibold text-white shadow-sm hover:bg-orange-600"
            >
              Unlock Premium
            </button>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
