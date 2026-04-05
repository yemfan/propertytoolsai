"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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

function formatFunnelStep(step: string): string {
  return step
    .replace(/^funnel_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function PremiumCard({
  children,
  className = "",
  glow = false,
}: {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_4px_24px_-4px_rgba(15,23,42,0.08),0_0_0_1px_rgba(15,23,42,0.04)] ${className}`.trim()}
    >
      {glow ? (
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl"
          aria-hidden
        />
      ) : null}
      <div className="relative">{children}</div>
    </div>
  );
}

function KpiStat({
  label,
  value,
  sub,
  delayClass,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  delayClass: string;
  accent?: "neutral" | "positive" | "negative";
}) {
  const accentRing =
    accent === "positive"
      ? "ring-emerald-500/15"
      : accent === "negative"
        ? "ring-rose-500/15"
        : "ring-slate-200/80";
  return (
    <div
      className={`revenue-enter ${delayClass} group relative rounded-2xl border border-slate-100 bg-gradient-to-br from-white to-slate-50/80 p-4 shadow-sm ring-1 ${accentRing} transition hover:shadow-md hover:ring-blue-500/10`}
    >
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</div>
      <div className="mt-2 font-heading text-2xl font-extrabold tracking-tight text-slate-900 tabular-nums">
        {value}
      </div>
      {sub ? <div className="mt-1 text-xs font-medium text-slate-500">{sub}</div> : null}
    </div>
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

  const momAccent = useMemo(() => {
    if (kpi?.revenueMomPct == null) return "neutral" as const;
    if (kpi.revenueMomPct > 0) return "positive" as const;
    if (kpi.revenueMomPct < 0) return "negative" as const;
    return "neutral" as const;
  }, [kpi?.revenueMomPct]);

  const momLabel =
    kpi?.revenueMomPct == null ? "—" : `${kpi.revenueMomPct > 0 ? "+" : ""}${kpi.revenueMomPct}%`;

  return (
    <div className="space-y-8 pb-12">
      {/* Hero */}
      <div className="revenue-enter relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 p-6 text-white shadow-xl shadow-slate-900/20 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_80%_at_100%_0%,rgba(59,130,246,0.25),transparent)]"
          aria-hidden
        />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur">
                <span className="revenue-live-dot inline-block h-2 w-2 rounded-full bg-emerald-400" />
                Live pipeline
              </span>
              <span className="text-xs text-slate-400">Refreshes every 30s · Realtime on new revenue & alerts</span>
            </div>
            <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
              Revenue intelligence
            </h1>
            <p className="text-sm leading-relaxed text-slate-300 sm:text-base">
              See revenue, funnel health, and risk in one view. Act on alerts fast—then let AI explain what
              changed and what to do next.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div
              className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1 backdrop-blur"
              role="group"
              aria-label="Report window"
            >
              {([7, 30, 90] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(d)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    days === d ? "bg-white text-slate-900 shadow-sm" : "text-slate-300 hover:text-white"
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void runInsights()}
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-900/30 transition hover:from-blue-400 hover:to-indigo-500 disabled:opacity-50"
            >
              {busy ? "Working…" : "Generate AI insights"}
            </button>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-xl border border-white/20 bg-transparent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Refresh data
            </button>
          </div>
        </div>
      </div>

      {!data?.ok && (
        <div className="revenue-enter rounded-2xl border border-amber-200/90 bg-gradient-to-r from-amber-50 to-orange-50/80 p-4 text-sm font-medium text-amber-950 shadow-sm">
          {data?.error ?? "Unable to load dashboard."}
        </div>
      )}

      {data?.ok && kpi && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiStat
            label="Revenue"
            value={fmtMoney(kpi.revenueCents)}
            delayClass=""
            accent="neutral"
          />
          <KpiStat
            label="vs prior period"
            value={momLabel}
            sub="Month-over-month"
            delayClass="revenue-delay-1"
            accent={momAccent}
          />
          <KpiStat
            label="Transactions"
            value={String(kpi.transactionCount)}
            delayClass="revenue-delay-2"
          />
          <KpiStat
            label="Avg deal"
            value={kpi.avgDealCents != null ? fmtMoney(kpi.avgDealCents) : "—"}
            delayClass="revenue-delay-3"
          />
          <KpiStat
            label="Funnel sessions"
            value={String(kpi.funnelSessions)}
            delayClass="revenue-delay-4"
          />
          <KpiStat label="Lead events" value={String(kpi.leadEvents)} delayClass="revenue-delay-5" />
          <KpiStat
            label="Est. conversion"
            value={kpi.funnelConversionPct != null ? `${kpi.funnelConversionPct}%` : "—"}
            sub="Purchase / views"
            delayClass="revenue-delay-6"
          />
          <KpiStat label="Window" value={`${days} days`} delayClass="revenue-delay-7" />
        </div>
      )}

      {data?.ok && chartData.length > 0 && (
        <PremiumCard className="p-1" glow>
          <div className="rounded-[14px] bg-gradient-to-br from-slate-50 to-white p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="font-heading text-base font-bold text-slate-900">Revenue trend</h2>
                <p className="text-xs text-slate-500">Daily recognized revenue in your selected window</p>
              </div>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="revenueStrokeGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#0072ce" />
                      <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 10px 40px -10px rgba(15,23,42,0.2)",
                    }}
                    formatter={(v: number) => [`$${Number(v).toFixed(2)}`, "Revenue"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenueDollars"
                    stroke="url(#revenueStrokeGradient)"
                    strokeWidth={2.5}
                    fill="url(#revenueAreaGradient)"
                    name="Revenue"
                    animationDuration={900}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </PremiumCard>
      )}

      {data?.ok && chartData.length === 0 && (
        <PremiumCard className="p-8 text-center">
          <p className="font-heading text-slate-900">No revenue in this window yet</p>
          <p className="mt-2 text-sm text-slate-500">
            Run a test funnel or connect Stripe—your chart will light up here.
          </p>
          <button
            type="button"
            onClick={() => void simulateFunnel()}
            className="mt-4 inline-flex rounded-xl bg-[#0072ce] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#0062b5]"
          >
            Simulate demo funnel
          </button>
        </PremiumCard>
      )}

      {data?.ok && data.funnel && data.funnel.length > 0 && (
        <PremiumCard className="p-5 sm:p-6" glow>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-heading text-base font-bold text-slate-900">Conversion funnel</h2>
              <p className="mt-1 text-xs text-slate-500">
                Where prospects drop—fix the step with the biggest leak first.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void simulateFunnel()}
              className="rounded-xl border border-blue-200 bg-blue-50/80 px-4 py-2 text-xs font-bold text-blue-800 transition hover:bg-blue-100"
            >
              Run demo funnel
            </button>
          </div>
          <div className="mt-6 space-y-4">
            {data.funnel.map((f) => {
              const w = Math.max(8, f.pctOfFirst);
              return (
                <div key={f.step}>
                  <div className="mb-1.5 flex justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-800">{formatFunnelStep(f.step)}</span>
                    <span className="tabular-nums text-slate-500">
                      <span className="font-medium text-slate-700">{f.count}</span>
                      <span className="text-slate-400"> · {f.pctOfFirst}% of top</span>
                      {f.dropOffPct != null ? (
                        <span className="text-rose-600"> · drop {f.dropOffPct}%</span>
                      ) : null}
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/80">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-500 shadow-sm transition-[width] duration-700 ease-out"
                      style={{ width: `${w}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </PremiumCard>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <PremiumCard className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-heading text-base font-bold text-slate-900">Alerts</h2>
              <p className="mt-0.5 text-xs text-slate-500">Recent threshold hits</p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void evaluateAlerts()}
              className="rounded-xl border border-slate-200 bg-[#0072ce] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#0062b5] disabled:opacity-50"
            >
              Run alert check
            </button>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Enable rules in the next card, then run a check. Cooldowns prevent duplicate notifications.
          </p>
          <ul className="mt-4 max-h-52 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50 text-sm">
            {(data?.alertsFeed ?? []).length === 0 ? (
              <li className="px-4 py-6 text-center text-slate-500">No alerts yet—your metrics are quiet.</li>
            ) : (
              (data?.alertsFeed ?? []).map((a) => (
                <li key={a.id} className="px-4 py-3 transition hover:bg-white">
                  <div className="font-medium text-slate-800">{a.message}</div>
                  <div className="mt-1 text-xs text-slate-400">{new Date(a.created_at).toLocaleString()}</div>
                </li>
              ))
            )}
          </ul>
        </PremiumCard>

        <PremiumCard className="p-5 sm:p-6">
          <h2 className="font-heading text-base font-bold text-slate-900">Alert rules</h2>
          <p className="mt-1 text-xs text-slate-500">Toggle what triggers notifications.</p>
          <ul className="mt-4 space-y-2">
            {(data?.rules ?? []).map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-3 transition hover:border-slate-200 hover:bg-white"
              >
                <div className="min-w-0">
                  <span className="font-mono text-xs font-semibold text-slate-800">{r.metric_key}</span>{" "}
                  <span className="text-xs text-slate-500">
                    {r.operator} {r.threshold_numeric}
                  </span>
                  <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    {r.severity}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void toggleRule(r.id, r.enabled)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    r.enabled
                      ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200/80"
                      : "bg-slate-200/80 text-slate-600 hover:bg-slate-300/80"
                  }`}
                >
                  {r.enabled ? "On" : "Off"}
                </button>
              </li>
            ))}
          </ul>
        </PremiumCard>
      </div>

      <PremiumCard className="overflow-hidden border-blue-200/60 bg-gradient-to-br from-white via-slate-50/80 to-blue-50/30 p-0" glow>
        <div className="border-b border-slate-100/80 bg-gradient-to-r from-indigo-600/10 to-blue-600/5 px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-heading text-base font-bold text-slate-900">AI insights</h2>
              <p className="text-xs text-slate-600">
                Plain-English summary of KPIs, funnel, and alerts—actionable next steps.
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void runInsights()}
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-900/20 transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {insight ? "Regenerate" : "Generate insights"}
            </button>
          </div>
        </div>
        <div className="p-5 sm:p-6">
          {insightModel ? <p className="mb-3 text-[10px] uppercase tracking-wider text-slate-400">Model: {insightModel}</p> : null}
          {insight ? (
            <div className="prose prose-sm prose-slate max-w-none whitespace-pre-wrap leading-relaxed text-slate-700">
              {insight}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white/60 p-6 text-center">
              <p className="text-sm text-slate-600">
                Click <strong>Generate insights</strong> to synthesize this dashboard. Requires{" "}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">OPENAI_API_KEY</code> on the server.
              </p>
            </div>
          )}
        </div>
      </PremiumCard>
    </div>
  );
}
