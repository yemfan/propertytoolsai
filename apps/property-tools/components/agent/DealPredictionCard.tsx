"use client";

import React, { useState } from "react";
import type { PredictionFactor } from "@/lib/deal-prediction/types";

function money(value?: number) {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function probabilityClass(value: number) {
  if (value >= 75) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (value >= 50) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
}

export function DealPredictionCard({
  leadId,
  initial,
}: {
  leadId: string;
  initial?: {
    closeProbability?: number;
    predictedDealValue?: number;
    predictedCloseWindow?: string | null;
    factors?: PredictionFactor[];
  };
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    closeProbability: initial?.closeProbability ?? 0,
    predictedDealValue: initial?.predictedDealValue ?? 0,
    predictedCloseWindow: initial?.predictedCloseWindow ?? "—",
    factors: initial?.factors ?? [],
  });
  const [error, setError] = useState("");

  async function refreshPrediction() {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/leads/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        prediction?: typeof data;
        error?: string;
      };
      if (!res.ok || !json?.success || !json.prediction) {
        throw new Error(json?.error || "Failed prediction");
      }
      setData({
        closeProbability: json.prediction.closeProbability,
        predictedDealValue: json.prediction.predictedDealValue,
        predictedCloseWindow: json.prediction.predictedCloseWindow,
        factors: json.prediction.factors ?? [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed prediction");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Deal Prediction</h2>
          <p className="mt-1 text-xs text-gray-500">Likelihood this lead turns into revenue.</p>
        </div>
        <button
          type="button"
          onClick={() => void refreshPrediction()}
          disabled={loading}
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:bg-gray-300"
        >
          {loading ? "Refreshing..." : "Refresh Prediction"}
        </button>
      </div>

      <div className="space-y-4 p-5">
        {error ? <div className="text-sm text-red-600">{error}</div> : null}

        <div className="grid gap-4 md:grid-cols-3">
          <Metric label="Close Probability">
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${probabilityClass(data.closeProbability)}`}
            >
              {data.closeProbability}%
            </span>
          </Metric>
          <Metric label="Predicted Deal Value">{money(data.predictedDealValue)}</Metric>
          <Metric label="Expected Window">{data.predictedCloseWindow}</Metric>
        </div>

        <div>
          <div className="mb-3 text-sm font-semibold text-gray-900">Top Factors</div>
          <div className="space-y-3">
            {data.factors.length ? (
              data.factors.map((factor, idx) => (
                <div key={`${factor.label}-${idx}`} className="rounded-xl border p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{factor.label}</span>
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                        factor.impact === "positive"
                          ? "bg-emerald-50 text-emerald-700"
                          : factor.impact === "negative"
                            ? "bg-red-50 text-red-700"
                            : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {factor.impact}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-gray-700">{factor.reason}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500">No prediction factors yet.</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-gray-50 p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-2 text-xl font-semibold text-gray-900">{children}</div>
    </div>
  );
}
