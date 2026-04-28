"use client";

import { useCallback, useEffect, useState } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { EmailEngagementPanel } from "@/components/dashboard/EmailEngagementPanel";
import { PipelineForecastPanel } from "@/components/dashboard/PipelineForecastPanel";
import { RevenuePanel } from "@/components/dashboard/RevenuePanel";

type Summary = {
  tasksCompleted: number;
  tasksSkipped: number;
  tasksPending: number;
  completionRate: number;
  hotLeads: number;
  highEngagementLeads: number;
  avgResponseTimeMinutes: number | null;
  fastestResponseMinutes: number | null;
  slowestResponseMinutes: number | null;
  highScoreLeadsWithResponse: number;
  highScoreLeadsTotal: number;
  alerts: Array<{ type: string; message: string }>;
};

type TrendDay = {
  date: string;
  label: string;
  tasks_done: number;
  tasks_skipped: number;
  engagement_events: number;
};

function MiniPie({ data, title }: { data: Array<{ name: string; value: number; color: string }>; title: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-xs font-semibold text-gray-500 mb-2">{title}</h3>
      <div className="flex items-center gap-3">
        <div className="h-[110px] w-[110px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" cx="50%" cy="50%" outerRadius={45} innerRadius={25} strokeWidth={1}>
                {data.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip formatter={(v: number) => v} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-1 text-xs">
          {data.map((d) => (
            <div key={d.name} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
              <span className="text-gray-600">{d.name}</span>
              <span className="font-semibold text-gray-900">{d.value}</span>
              {total > 0 && <span className="text-gray-400">({Math.round((d.value / total) * 100)}%)</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PerformanceClient() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [trends, setTrends] = useState<TrendDay[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [sumRes, trendRes] = await Promise.all([
        fetch("/api/performance/summary").then((r) => r.json()).catch(() => ({})),
        fetch("/api/performance/trends").then((r) => r.json()).catch(() => ({})),
      ]);
      if (sumRes.ok !== false) setSummary(sumRes);
      if (trendRes.ok !== false) setTrends(trendRes.days ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return <div className="py-20 text-center text-gray-400">Loading performance data...</div>;

  const s = summary;

  const taskPie = [
    { name: "Completed", value: s?.tasksCompleted ?? 0, color: "#22c55e" },
    { name: "Skipped", value: s?.tasksSkipped ?? 0, color: "#f59e0b" },
    { name: "Pending", value: s?.tasksPending ?? 0, color: "#e5e7eb" },
  ];

  const conversionRate = s && s.highScoreLeadsTotal > 0
    ? Math.round((s.highScoreLeadsWithResponse / s.highScoreLeadsTotal) * 100)
    : 0;

  const trendLabels = trends.map((t) => ({
    ...t,
    label: new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Performance</h1>
        <p className="text-sm text-gray-500">Revenue, pipeline, and day-to-day engagement — one view.</p>
      </div>

      {/* Revenue & commission — the "how am I doing" section agents actually
          open this page to see. Kept at the top; the existing engagement
          metrics (tasks, response time, hot leads) are below. */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-900">Revenue &amp; commission</h2>
        <RevenuePanel />
      </section>

      <section className="space-y-4 border-t border-slate-200 pt-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Pipeline forecast</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            What&apos;s on deck — active and pending deals weighted by close-date proximity.
          </p>
        </div>
        <PipelineForecastPanel />
      </section>

      <section className="space-y-4 border-t border-slate-200 pt-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Email engagement</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Opens & clicks across outbound mail — pulled from Resend webhook events.
          </p>
        </div>
        <EmailEngagementPanel />
      </section>

      <section className="space-y-4 border-t border-slate-200 pt-5">
        <h2 className="text-sm font-semibold text-gray-900">Engagement</h2>

      {/* Alerts */}
      {s?.alerts?.length ? (
        <div className="space-y-2">
          {s.alerts.map((a, i) => (
            <div key={i} className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              {a.message}
            </div>
          ))}
        </div>
      ) : null}

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Tasks Completed</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{s?.tasksCompleted ?? 0}</p>
          <p className="mt-1 text-xs text-gray-400">out of {(s?.tasksCompleted ?? 0) + (s?.tasksSkipped ?? 0) + (s?.tasksPending ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Completion Rate</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{s?.completionRate ?? 0}%</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Hot Leads</p>
          <p className="mt-1 text-3xl font-bold text-red-600">{s?.hotLeads ?? 0}</p>
          <p className="mt-1 text-xs text-gray-400">{s?.highEngagementLeads ?? 0} high engagement</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Avg Response Time</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">
            {s?.avgResponseTimeMinutes != null ? `${s.avgResponseTimeMinutes}m` : "\u2014"}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {s?.fastestResponseMinutes != null ? `Best: ${s.fastestResponseMinutes}m` : ""}
          </p>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid gap-3 md:grid-cols-2">
        <MiniPie data={taskPie} title="Task Breakdown (7 days)" />

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="text-xs font-semibold text-gray-500 mb-2">Conversion — High-Score Lead Response</h3>
          <div className="flex items-center gap-4">
            <div className="text-4xl font-bold text-gray-900">{conversionRate}%</div>
            <div className="text-xs text-gray-500">
              <p>{s?.highScoreLeadsWithResponse ?? 0} of {s?.highScoreLeadsTotal ?? 0} high-score leads received a response.</p>
              <p className="mt-1">Higher response rate = more closed deals.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Trend charts */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="text-xs font-semibold text-gray-500 mb-2">Engagement Events (14 days)</h3>
          <div className="h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendLabels} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} stroke="#9ca3af" interval={2} />
                <YAxis tick={{ fontSize: 9 }} stroke="#9ca3af" allowDecimals={false} />
                <Tooltip formatter={(v: number) => [v, "Events"]} />
                <Line type="monotone" dataKey="engagement_events" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="text-xs font-semibold text-gray-500 mb-2">Tasks Done vs Skipped (14 days)</h3>
          <div className="h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendLabels} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} stroke="#9ca3af" interval={2} />
                <YAxis tick={{ fontSize: 9 }} stroke="#9ca3af" allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="tasks_done" fill="#22c55e" name="Done" radius={[2, 2, 0, 0]} />
                <Bar dataKey="tasks_skipped" fill="#f59e0b" name="Skipped" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      </section>
    </div>
  );
}
