"use client";

import { useState } from "react";

type WorkflowResult = {
  modelVersion?: string;
  rowCount?: number;
  trainingOutput?: {
    metrics?: { backend?: string; mape?: number; mae?: number; r2?: number };
  };
  registered?: { status?: string; id?: string };
};

export function ValuationModelWorkflowPanel() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WorkflowResult | null>(null);
  const [error, setError] = useState("");
  const [activateAfterTraining, setActivateAfterTraining] = useState(false);
  const [notes, setNotes] = useState("");
  const [minRows, setMinRows] = useState(30);

  async function runWorkflow() {
    try {
      setLoading(true);
      setError("");
      setResult(null);

      const res = await fetch("/api/admin/valuation/training/run-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exportName: `valuation_training_${new Date().toISOString().slice(0, 10)}`,
          minRows,
          filters: {
            requireSqft: true,
            minComparableCount: 1,
          },
          activateAfterTraining,
          notes: notes.trim() || undefined,
        }),
      });

      const json = (await res.json()) as { success?: boolean; error?: string } & WorkflowResult;
      if (!res.ok || !json?.success) throw new Error(json?.error || "Workflow failed");
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Workflow failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-semibold text-gray-900">Train and register valuation model</h2>
        <p className="mt-1 text-xs text-gray-500">
          Export labeled rows, run Python training, store metrics in the registry, optionally activate.
        </p>
        <p className="mt-2 text-xs text-amber-800">
          Requires Python with <code className="rounded bg-amber-50 px-1">pandas</code>,{" "}
          <code className="rounded bg-amber-50 px-1">scikit-learn</code>, <code className="rounded bg-amber-50 px-1">joblib</code>{" "}
          (see <code className="rounded bg-amber-50 px-1">ml/valuation/requirements.txt</code>) on the machine running
          Next.js.
        </p>
      </div>
      <div className="space-y-4 p-5">
        <label className="block text-sm text-gray-700">
          Minimum labeled rows
          <input
            type="number"
            min={1}
            max={100000}
            value={minRows}
            onChange={(e) => setMinRows(Number(e.target.value) || 30)}
            className="mt-1 w-full max-w-xs rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={activateAfterTraining}
            onChange={(e) => setActivateAfterTraining(e.target.checked)}
          />
          Activate immediately after training
        </label>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-[90px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          placeholder="Notes about this training run"
        />

        <button
          type="button"
          onClick={() => void runWorkflow()}
          disabled={loading}
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:bg-gray-300"
        >
          {loading ? "Running workflow..." : "Run workflow"}
        </button>

        {error ? <div className="text-sm text-red-600">{error}</div> : null}

        {result ? (
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-gray-700">
            <div>
              <strong>Model version:</strong> {result.modelVersion}
            </div>
            <div>
              <strong>Rows used:</strong> {result.rowCount}
            </div>
            <div>
              <strong>Backend:</strong> {result.trainingOutput?.metrics?.backend}
            </div>
            <div>
              <strong>MAPE:</strong> {result.trainingOutput?.metrics?.mape}
            </div>
            <div>
              <strong>MAE:</strong> {result.trainingOutput?.metrics?.mae}
            </div>
            <div>
              <strong>R²:</strong> {result.trainingOutput?.metrics?.r2}
            </div>
            <div>
              <strong>Status:</strong> {result.registered?.status}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
