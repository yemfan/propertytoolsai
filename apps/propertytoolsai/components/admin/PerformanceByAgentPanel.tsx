"use client";

import { useEffect, useState } from "react";
import type { AgentPerformanceRow } from "@/lib/performance/types";

export function PerformanceByAgentPanel() {
  const [rows, setRows] = useState<AgentPerformanceRow[]>([]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/performance/by-agent", { cache: "no-store" });
      const json = await res.json();
      if (json?.success) setRows((json.rows as AgentPerformanceRow[]) || []);
    })();
  }, []);

  if (!rows.length) {
    return (
      <section className="rounded-2xl border bg-white p-5 text-sm text-gray-500 shadow-sm">
        No agent data yet — assign leads with <code className="text-xs">assigned_agent_id</code> or add
        agents.
      </section>
    );
  }

  return (
    <section className="rounded-2xl border bg-white shadow-sm">
      <div className="border-b px-5 py-4">
        <h2 className="text-base font-semibold text-gray-900">Performance by Agent</h2>
      </div>
      <div className="space-y-3 p-5">
        {rows.map((row) => (
          <div key={row.agentId} className="rounded-xl border p-4 text-sm">
            <div className="font-medium text-gray-900">{row.agentName}</div>
            <div className="mt-2 text-gray-600">
              Leads {row.leadsAssigned} • Hot {row.hotLeads} • Replies {row.repliesSent} • Conversions{" "}
              {row.conversions} • Close Rate {row.closeRate}% • Avg Response {row.avgResponseMinutes} min
            </div>
            <div className="mt-1 font-medium text-gray-900">Revenue {formatMoney(row.grossRevenue)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}
