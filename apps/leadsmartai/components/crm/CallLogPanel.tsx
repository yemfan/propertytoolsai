"use client";

import { useEffect, useState } from "react";

type LeadJoin = { name?: string | null; phone?: string | null; phone_number?: string | null };

export type LeadCallListRow = {
  id: string;
  contact_id: string | null;
  twilio_call_sid: string;
  from_phone: string;
  to_phone: string;
  status: string | null;
  inferred_intent: string | null;
  hot_lead: boolean;
  needs_human: boolean;
  summary: string | null;
  transcript: string | null;
  created_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  leads: LeadJoin | LeadJoin[] | null;
};

function leadLabel(row: LeadCallListRow) {
  const lj = row.leads;
  const one = Array.isArray(lj) ? lj[0] : lj;
  const name = one?.name?.trim();
  const phone = one?.phone_number || one?.phone || row.from_phone;
  if (name) return `${name} · ${phone}`;
  return phone || "Unknown";
}

export function CallLogPanel() {
  const [calls, setCalls] = useState<LeadCallListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/dashboard/lead-calls?limit=40", { credentials: "include" });
        const j = (await res.json()) as { calls?: LeadCallListRow[]; error?: string };
        if (!res.ok) throw new Error(j.error || res.statusText);
        if (!cancelled) setCalls(j.calls ?? []);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="text-sm text-slate-600">Loading call log…</p>;
  }
  if (err) {
    return <p className="text-sm text-red-600">{err}</p>;
  }
  if (calls.length === 0) {
    return <p className="text-sm text-slate-600">No voice calls yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            <th className="px-3 py-2 font-medium text-slate-700">When</th>
            <th className="px-3 py-2 font-medium text-slate-700">Lead</th>
            <th className="px-3 py-2 font-medium text-slate-700">Status</th>
            <th className="px-3 py-2 font-medium text-slate-700">Intent</th>
            <th className="px-3 py-2 font-medium text-slate-700">Flags</th>
            <th className="px-3 py-2 font-medium text-slate-700">Summary</th>
          </tr>
        </thead>
        <tbody>
          {calls.map((row) => (
            <tr key={row.id} className="border-b border-slate-100 last:border-0">
              <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                {new Date(row.created_at).toLocaleString()}
              </td>
              <td className="max-w-[200px] truncate px-3 py-2 text-slate-900">{leadLabel(row)}</td>
              <td className="px-3 py-2 text-slate-700">{row.status ?? "—"}</td>
              <td className="px-3 py-2 text-slate-700">{row.inferred_intent ?? "—"}</td>
              <td className="px-3 py-2">
                {row.hot_lead && (
                  <span className="mr-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900">
                    Hot
                  </span>
                )}
                {row.needs_human && (
                  <span className="rounded bg-rose-100 px-1.5 py-0.5 text-xs font-medium text-rose-900">
                    Human
                  </span>
                )}
                {!row.hot_lead && !row.needs_human && <span className="text-slate-400">—</span>}
              </td>
              <td className="max-w-md truncate px-3 py-2 text-slate-600" title={row.summary || ""}>
                {row.summary || row.transcript || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
