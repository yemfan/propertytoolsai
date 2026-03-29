"use client";

import { useEffect, useState } from "react";

type Row = {
  id?: string;
  event_type?: string;
  channel?: string;
  status?: string;
  body?: string;
  created_at?: string;
  skipped_reason?: string | null;
};

export function GreetingHistoryPanel({ leadId }: { leadId: string }) {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/leads/${leadId}/greeting-history`, { cache: "no-store" });
        const json = (await res.json().catch(() => ({}))) as { success?: boolean; rows?: Row[] };
        if (!cancelled && json?.success) setRows(Array.isArray(json.rows) ? json.rows : []);
      } catch {
        if (!cancelled) setRows([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">Greeting history</h2>
      </div>
      <div className="space-y-3 p-5">
        {rows.length ? (
          rows.map((row) => (
            <div key={row.id} className="rounded-xl border border-slate-100 p-4 text-sm">
              <div className="font-medium text-slate-900">
                {row.event_type} • {row.channel}
              </div>
              <div className="mt-1 text-slate-500">
                {row.status}
                {row.created_at ? ` • ${new Date(row.created_at).toLocaleString()}` : ""}
                {row.skipped_reason ? ` • ${row.skipped_reason}` : ""}
              </div>
              <div className="mt-2 text-slate-800 whitespace-pre-wrap">{row.body}</div>
            </div>
          ))
        ) : (
          <div className="text-sm text-slate-500">No greeting history yet.</div>
        )}
      </div>
    </section>
  );
}
