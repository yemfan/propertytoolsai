"use client";

import { useEffect, useState } from "react";

type RegistryModel = {
  id: string;
  modelVersion: string;
  backend: string;
  rowsUsed: number;
  status: string;
  isActive: boolean;
  metrics?: { mape?: number; mae?: number; r2?: number };
};

export function ValuationModelRegistryPanel() {
  const [models, setModels] = useState<RegistryModel[]>([]);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/admin/valuation/models", { cache: "no-store" });
    const json = (await res.json()) as { success?: boolean; models?: RegistryModel[] };
    if (json?.success) setModels(json.models || []);
  }

  async function activate(modelId: string) {
    try {
      setError("");
      const res = await fetch("/api/admin/valuation/models/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json?.success) throw new Error(json?.error || "Activation failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Activation failed");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-semibold text-gray-900">Valuation model registry</h2>
        <p className="mt-1 text-xs text-gray-500">Candidates and active AVM model versions.</p>
      </div>
      <div className="space-y-3 p-5">
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
        {models.length === 0 ? (
          <div className="text-sm text-gray-500">No registered models yet. Run the training workflow first.</div>
        ) : null}
        {models.map((model) => (
          <div key={model.id} className="rounded-xl border border-slate-100 p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-medium text-gray-900">{model.modelVersion}</div>
                <div className="mt-1 text-gray-600">
                  {model.backend} • rows {model.rowsUsed} • status {model.status}
                </div>
                <div className="mt-1 text-gray-500">
                  MAPE {model.metrics?.mape} • MAE {model.metrics?.mae} • R² {model.metrics?.r2}
                </div>
              </div>
              <div>
                {model.isActive ? (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                    Active
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void activate(model.id)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-gray-900"
                  >
                    Activate
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
