"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/lib/supabaseClient";

type SummaryResponse = {
  ok: boolean;
  agentId?: string;
  windowDays?: number;
  kpi?: {
    revenueCents: number;
    revenueCentsPrior: number;
    revenueMomPct: number | null;
    transactionCount: number;
    avgDealCents: number | null;
    funnelSessions: number;
    leadEvents: number;
    funnelConversionPct: number | null;
  };
  series?: { day: string; revenueCents: number; transactions: number }[];
  funnel?: { step: string; count: number; pctOfFirst: number; dropOffPct: number | null }[];
  rules?: {
    id: string;
    metric_key: string;
    operator: string;
    threshold_numeric: number;
    severity: string;
    enabled: boolean;
    cooldown_minutes: number;
  }[];
  alertsFeed?: { id: string; message: string; created_at: string }[];
  error?: string;
};

function fmtMoney(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100
  );
}

export default function RevenueDashboardClient() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [insightModel, setInsightModel] = useState<string | null>(null);
  const [sessionId] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `sess_${Date.now()}`
  );

  const load = useCallback(async () => {
    const res = await fetch(`/api/dashboard/revenue/summary?days=${days}`, {
      credentials: "include",
    });
    const json = (await res.json()) as SummaryResponse;
    setData(json);
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(id);
  }, [load]);

  const agentId = data?.agentId;

  useEffect(() => {
    if (!agentId) return;
    const ch = supabase
      .channel(`revenue-kpi-${agentId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "revenue_transactions",
          filter: `agent_id=eq.${agentId}`,
        },
        () => void load()
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "kpi_alert_events",
          filter: `agent_id=eq.${agentId}`,
        },
        () => void load()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [agentId, load]);

  async function runInsights() {
    setBusy(true);
    setInsight(null);
    try {
      const res = await fetch("/api/dashboard/revenue/insights", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      });
      const json = await res.json();
      if (json.ok) {
        setInsight(String(json.text ?? ""));
        setInsightModel(json.model ? String(json.model) : null);
      } else {
        setInsight(json.error ?? "Failed");
      }
    } finally {
      setBusy(false);
    }
  }

  async function evaluateAlerts() {
    setBusy(true);
    try {
      await fetch("/api/dashboard/revenue/evaluate-alerts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function toggleRule(ruleId: string, enabled: boolean) {
    await fetch("/api/dashboard/revenue/rules", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ruleId, enabled: !enabled }),
    });
    await load();
  }

  async function simulateFunnel() {
    const steps = [
      "funnel_page_view",
      "funnel_tool_open",
      "funnel_lead_submit",
      "funnel_booking",
      "funnel_purchase",
    ];
    for (const eventName of steps) {
      await fetch("/api/revenue/track", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventName, sessionId, properties: { demo: true } }),
      });
    }
    await load();
  }

  const chartData = useMemo(() => {
    const s = data?.series ?? [];
    return s.map((row) => ({
      ...row,
      revenueDollars: row.revenueCents / 100,
    }));
  }, [data?.series]);

  const kpi = data?.kpi;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="ui-page-title text-brand-text">Revenue & KPIs</h1>
          <p className="ui-page-subtitle text-brand-text/80">
            Funnel events, revenue, alerts, and AI insights. Updates every 30s; live inserts when
            Realtime is enabled.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
          <button
            type="button"
            disabled={busy}
            onClick={() => void load()}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {!data?.ok && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {data?.error ?? "Unable to load dashboard."}
        </div>
      )}

      {data?.ok && kpi && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Revenue" value={fmtMoney(kpi.revenueCents)} />
          <Stat
            label="vs prior period"
            value={
              kpi.revenueMomPct == null ? "—" : `${kpi.revenueMomPct > 0 ? "+" : ""}${kpi.revenueMomPct}%`
            }
          />
          <Stat label="Transactions" value={String(kpi.transactionCount)} />
          <Stat label="Avg deal" value={kpi.avgDealCents != null ? fmtMoney(kpi.avgDealCents) : "—"} />
          <Stat label="Funnel sessions" value={String(kpi.funnelSessions)} />
          <Stat label="Lead events" value={String(kpi.leadEvents)} />
          <Stat
            label="Est. conv. (purchase / views)"
            value={kpi.funnelConversionPct != null ? `${kpi.funnelConversionPct}%` : "—"}
          />
          <Stat label="Window" value={`${days}d`} />
        </div>
      )}

      {data?.ok && chartData.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 h-72">
          <div className="text-sm font-bold text-slate-900 mb-2">Revenue by day</div>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#64748b" />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="#64748b"
                tickFormatter={(v) => `$${v}`}
              />
              <Tooltip formatter={(v: number) => [`$${Number(v).toFixed(2)}`, "Revenue"]} />
              <Area
                type="monotone"
                dataKey="revenueDollars"
                stroke="#2563eb"
                fill="#93c5fd"
                name="Revenue"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {data?.ok && data.funnel && data.funnel.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-4">
          <div className="flex flex-wrap justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900">Funnel</h2>
            <button
              type="button"
              onClick={() => void simulateFunnel()}
              className="text-xs font-semibold text-blue-700 hover:underline"
            >
              Simulate funnel (demo events)
            </button>
          </div>
          <div className="space-y-2">
            {data.funnel.map((f) => {
              const w = Math.max(8, f.pctOfFirst);
              return (
                <div key={f.step}>
                  <div className="flex justify-between text-xs text-slate-600 mb-1">
                    <span className="font-mono">{f.step}</span>
                    <span>
                      {f.count} ({f.pctOfFirst}% of top
                      {f.dropOffPct != null ? ` · drop ${f.dropOffPct}%` : ""})
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-500"
                      style={{ width: `${w}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-3">
          <div className="flex flex-wrap justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900">Alerts</h2>
            <button
              type="button"
              disabled={busy}
              onClick={() => void evaluateAlerts()}
              className="rounded-lg bg-slate-900 text-white text-xs font-semibold px-3 py-1.5 disabled:opacity-50"
            >
              Run alert check
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Enable rules below, then run a check. Cooldowns prevent repeat notifications.
          </p>
          <ul className="divide-y divide-slate-100 max-h-48 overflow-y-auto text-sm">
            {(data?.alertsFeed ?? []).length === 0 ? (
              <li className="py-2 text-slate-500">No alerts yet.</li>
            ) : (
              (data?.alertsFeed ?? []).map((a) => (
                <li key={a.id} className="py-2">
                  <div className="text-slate-800">{a.message}</div>
                  <div className="text-xs text-slate-400">{new Date(a.created_at).toLocaleString()}</div>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900">Alert rules</h2>
          <ul className="space-y-2 text-sm">
            {(data?.rules ?? []).map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 border border-slate-100 rounded-lg px-3 py-2"
              >
                <div>
                  <span className="font-mono text-xs">{r.metric_key}</span>{" "}
                  <span className="text-slate-500">
                    {r.operator} {r.threshold_numeric}
                  </span>
                  <span className="ml-2 text-xs uppercase text-slate-400">{r.severity}</span>
                </div>
                <button
                  type="button"
                  onClick={() => void toggleRule(r.id, r.enabled)}
                  className={`text-xs font-semibold px-2 py-1 rounded ${
                    r.enabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {r.enabled ? "On" : "Off"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-3">
        <div className="flex flex-wrap justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900">AI insights</h2>
          <button
            type="button"
            disabled={busy}
            onClick={() => void runInsights()}
            className="rounded-lg bg-indigo-600 text-white text-sm font-semibold px-4 py-2 disabled:opacity-50"
          >
            Generate insights
          </button>
        </div>
        {insightModel && (
          <p className="text-xs text-slate-400">Model: {insightModel}</p>
        )}
        {insight && (
          <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap">{insight}</div>
        )}
        {!insight && (
          <p className="text-sm text-slate-500">
            Summarizes KPIs, funnel, and recent alerts. Requires{" "}
            <code className="text-xs bg-slate-100 px-1 rounded">OPENAI_API_KEY</code>.
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-extrabold text-slate-900">{value}</div>
    </div>
  );
}
