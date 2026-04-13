"use client";

import { useEffect, useState } from "react";

type ToolUsageData = {
  tools: Record<string, { total: number; last7d: number; last30d: number }>;
  daily: Record<string, number>;
  leadCount: number;
  totalEvents: number;
};

export default function ToolUsagePage() {
  const [data, setData] = useState<ToolUsageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/tool-usage")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setData(j);
        else setError(j.error ?? "Failed to load");
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;
  if (!data) return <div className="p-6 text-gray-500">Loading usage data...</div>;

  const toolNames = Object.keys(data.tools).sort((a, b) => data.tools[b].total - data.tools[a].total);
  const dailyDays = Object.keys(data.daily).sort().reverse().slice(0, 30);

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tool Usage Report</h1>
        <p className="mt-1 text-sm text-gray-600">
          Total events: {data.totalEvents.toLocaleString()} · Leads captured: {data.leadCount.toLocaleString()}
        </p>
      </div>

      {/* Tool breakdown table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
            <tr>
              <th className="px-4 py-3">Tool</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Last 7 days</th>
              <th className="px-4 py-3 text-right">Last 30 days</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {toolNames.map((tool) => (
              <tr key={tool} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  {tool.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </td>
                <td className="px-4 py-3 text-right font-mono">{data.tools[tool].total}</td>
                <td className="px-4 py-3 text-right font-mono">{data.tools[tool].last7d}</td>
                <td className="px-4 py-3 text-right font-mono">{data.tools[tool].last30d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Daily breakdown */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Daily Activity (Last 30 Days)</h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Events</th>
                <th className="px-4 py-3">Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {dailyDays.map((day) => {
                const count = data.daily[day];
                const maxCount = Math.max(...Object.values(data.daily));
                const barWidth = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
                return (
                  <tr key={day} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-700">{day}</td>
                    <td className="px-4 py-2 text-right font-mono">{count}</td>
                    <td className="px-4 py-2">
                      <div className="h-4 rounded-full bg-blue-100" style={{ width: "100%" }}>
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{ width: barWidth + "%" }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
