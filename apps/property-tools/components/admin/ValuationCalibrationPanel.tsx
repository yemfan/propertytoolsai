"use client";

import { useEffect, useState } from "react";

type ProfileRow = {
  scenarioKey: string;
  compsWeight: number;
  apiWeight: number;
  trendWeight: number;
  taxWeight: number;
  sampleSize: number;
  medianErrorPct: number;
  insideRangePct: number;
  version: number;
  notes?: string | null;
};

export function ValuationCalibrationPanel() {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/admin/valuation/calibration", { cache: "no-store" });
    const json = (await res.json()) as { success?: boolean; profiles?: ProfileRow[] };
    if (json?.success) setProfiles(json.profiles || []);
  }

  async function runCalibration() {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/admin/valuation/calibration", { method: "POST" });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json?.success) throw new Error(json?.error || "Calibration failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Calibration failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Valuation auto-calibration</h2>
          <p className="mt-1 text-xs text-gray-500">Scenario-based weights learned from historical sales.</p>
        </div>
        <button
          type="button"
          onClick={() => void runCalibration()}
          disabled={loading}
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:bg-gray-300"
        >
          {loading ? "Calibrating..." : "Run calibration"}
        </button>
      </div>

      <div className="space-y-3 p-5">
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
        {profiles.length === 0 ? (
          <div className="text-sm text-gray-500">
            No calibration profiles yet. Run calibration to build weights from sale outcomes.
          </div>
        ) : null}
        {profiles.map((p) => (
          <div key={p.scenarioKey} className="rounded-xl border border-slate-100 p-4 text-sm">
            <div className="font-medium text-gray-900">{p.scenarioKey}</div>
            <div className="mt-2 text-gray-600">
              Weights — Comps {pct(p.compsWeight)} • API {pct(p.apiWeight)} • Trend {pct(p.trendWeight)} • Tax{" "}
              {pct(p.taxWeight)}
            </div>
            <div className="mt-1 text-gray-600">
              Samples {p.sampleSize} • Median error {p.medianErrorPct}% • Inside range {p.insideRangePct}% • Version{" "}
              {p.version}
            </div>
            {p.notes ? <div className="mt-2 text-gray-500">{p.notes}</div> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}
