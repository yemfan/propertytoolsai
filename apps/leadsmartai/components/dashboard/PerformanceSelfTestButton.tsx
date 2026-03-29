"use client";

import { useState } from "react";

type Check = {
  path: string;
  ok: boolean;
  status: number;
  message: string;
};

export default function PerformanceSelfTestButton() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Check[] | null>(null);

  async function run() {
    setRunning(true);
    setResults(null);
    const paths = ["/api/performance/summary", "/api/performance/trends", "/api/tasks"];
    const out: Check[] = [];

    for (const path of paths) {
      try {
        const res = await fetch(path, { credentials: "include" });
        const json = (await res.json().catch(() => ({}))) as any;
        out.push({
          path,
          ok: res.ok && json?.ok !== false,
          status: res.status,
          message: json?.error ?? "ok",
        });
      } catch (e: any) {
        out.push({
          path,
          ok: false,
          status: 0,
          message: e?.message ?? "request failed",
        });
      }
    }

    setResults(out);
    setRunning(false);
  }

  const hasFail = results?.some((r) => !r.ok) ?? false;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-slate-800">Authenticated API self-test</div>
          <div className="text-[11px] text-slate-500">Checks performance + tasks endpoints using your session.</div>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-60"
        >
          {running ? "Running..." : "Run self-test"}
        </button>
      </div>

      {results ? (
        <div className="mt-3 space-y-1">
          <div className={`text-xs font-semibold ${hasFail ? "text-amber-700" : "text-emerald-700"}`}>
            {hasFail ? "Some checks failed" : "All checks passed"}
          </div>
          {results.map((r) => (
            <div key={r.path} className="text-[11px] text-slate-700">
              <span className={r.ok ? "text-emerald-700" : "text-amber-700"}>
                {r.ok ? "PASS" : "FAIL"}
              </span>{" "}
              {r.path} ({r.status}) - {r.message}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

