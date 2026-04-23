"use client";

import { useMemo, useState } from "react";

export type GrowthDigestLogRow = {
  id: string;
  agentId: string;
  agentEmail: string | null;
  agentFirstName: string | null;
  digestDate: string;
  opportunityCount: number;
  emailSent: boolean;
  skippedReason: string | null;
  error: string | null;
  createdAt: string;
};

type FilterMode = "all" | "sent" | "skipped" | "errored";

export function GrowthDigestLogClient({
  rows,
  error,
  cutoffIso,
}: {
  rows: GrowthDigestLogRow[];
  error: string | null;
  cutoffIso: string;
}) {
  const [filter, setFilter] = useState<FilterMode>("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "sent" && !r.emailSent) return false;
      if (filter === "skipped" && (r.emailSent || r.error)) return false;
      if (filter === "errored" && !r.error) return false;
      if (!needle) return true;
      return (
        r.agentEmail?.toLowerCase().includes(needle) ||
        r.agentId.toLowerCase().includes(needle) ||
        r.agentFirstName?.toLowerCase().includes(needle)
      );
    });
  }, [rows, filter, q]);

  const summary = useMemo(() => {
    let sent = 0;
    let skipped = 0;
    let errored = 0;
    for (const r of rows) {
      if (r.error) errored += 1;
      else if (r.emailSent) sent += 1;
      else skipped += 1;
    }
    return { sent, skipped, errored, total: rows.length };
  }, [rows]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Growth digest log</h1>
        <p className="mt-1 text-sm text-slate-500">
          Weekly Growth &amp; Opportunities email run history. Shows digests generated on or after{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">{cutoffIso}</code>{" "}
          (last 28 days). Support tool — not linked in the sidebar.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Error loading rows: {error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total" value={summary.total} />
        <Stat label="Sent" value={summary.sent} tone="green" />
        <Stat label="Skipped" value={summary.skipped} />
        <Stat
          label="Errored"
          value={summary.errored}
          tone={summary.errored > 0 ? "red" : "neutral"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by agent email / id / name…"
          className="min-w-[240px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterMode)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        >
          <option value="all">All rows</option>
          <option value="sent">Sent only</option>
          <option value="skipped">Skipped (below threshold / opt-out)</option>
          <option value="errored">Errored only</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Digest date</th>
                <th className="px-3 py-2 text-left font-medium">Agent</th>
                <th className="px-3 py-2 text-right font-medium">Opportunities</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Recorded at</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-[12px] text-slate-900">
                    {r.digestDate}
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-slate-900">
                      {r.agentEmail ?? <span className="text-slate-400">—</span>}
                    </div>
                    <div className="font-mono text-[10px] text-slate-400">{r.agentId}</div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.opportunityCount}</td>
                  <td className="px-3 py-2">
                    {r.error ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                          Errored
                        </span>
                        <span
                          className="max-w-xs truncate text-[11px] text-red-600"
                          title={r.error}
                        >
                          {r.error}
                        </span>
                      </span>
                    ) : r.emailSent ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
                        Sent
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                          Skipped
                        </span>
                        {r.skippedReason ? (
                          <span
                            className="max-w-xs truncate text-[11px] text-slate-500"
                            title={r.skippedReason}
                          >
                            {r.skippedReason}
                          </span>
                        ) : null}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-[11px] text-slate-500">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-400">
                    No matching rows.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "red" | "green" | "neutral";
}) {
  const textColor =
    tone === "red"
      ? "text-red-600"
      : tone === "green"
        ? "text-green-600"
        : "text-slate-900";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="text-[11px] font-medium text-slate-500">{label}</div>
      <div className={`text-xl font-semibold ${textColor}`}>{value}</div>
    </div>
  );
}
