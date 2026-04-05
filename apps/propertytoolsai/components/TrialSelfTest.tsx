"use client";

import { useState } from "react";
import { mergeAuthHeaders } from "@/lib/mergeAuthHeaders";

export default function TrialSelfTest() {
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  async function run() {
    setRunning(true);
    setLog([]);
    const lines: string[] = [];

    async function call(path: string, init?: RequestInit) {
      const headers = await mergeAuthHeaders(init?.headers);
      const res = await fetch(path, { credentials: "include", ...(init ?? {}), headers });
      const json = (await res.json().catch(() => ({}))) as any;
      lines.push(`${path} -> ${res.status} ${json?.ok === false ? "FAIL" : "OK"} ${json?.error ?? ""}`.trim());
      return { res, json };
    }

    try {
      // 1) Check current plan
      const before = await call("/api/check-plan", { method: "POST" });

      // 2) Try to start trial (only succeeds once)
      const started = await call("/api/start-trial", { method: "POST" });

      // 3) Re-check plan to confirm trialing status
      const after = await call("/api/check-plan", { method: "POST" });

      // Basic assertion hints
      if (before.res.status === 200 && started.res.status === 200 && after.res.status === 200) {
        lines.push("Expected: after.subscription_status = trialing, access = full");
      } else if (started.res.status === 400) {
        lines.push("If this says 'Trial already used', that's expected on repeat runs.");
      } else if (started.res.status === 401) {
        lines.push("You must be logged in for start-trial to work.");
      }
    } catch (e: any) {
      lines.push(`Error: ${e?.message ?? "unknown"}`);
    } finally {
      setLog(lines);
      setRunning(false);
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Trial self-test</div>
          <div className="text-xs text-slate-600 mt-1">
            Runs `check-plan` → `start-trial` → `check-plan` using your current session.
          </div>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="inline-flex items-center justify-center rounded-lg bg-[#0072ce] hover:bg-[#0062b5] text-white font-semibold px-4 py-2.5 disabled:opacity-60"
        >
          {running ? "Running..." : "Run test"}
        </button>
      </div>

      {log.length ? (
        <div className="mt-4 space-y-1 text-[12px] text-slate-700">
          {log.map((l, i) => (
            <div key={i} className="font-mono">
              {l}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

