"use client";

import { useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";
import { LineTrendCard } from "@/components/dashboard/LineTrendCard";
import { BarBreakdownCard } from "@/components/dashboard/BarBreakdownCard";
import type { AgentDashboardResponse } from "@/lib/dashboard/agent";
import { getPresetDateRange, type DateRange } from "@/lib/dashboard/dateRange";
import { useDashboardData } from "@/lib/dashboard/useDashboardData";

export default function AgentDashboardClient() {
  const [range, setRange] = useState<DateRange>(getPresetDateRange("30d"));

  const { data, loading, error } = useDashboardData<
    { success: true } & AgentDashboardResponse
  >("/api/dashboard/agent/overview", {
    start: range.start,
    end: range.end,
  });

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Loading agent dashboard...</div>;
  }

  if (error || !data) {
    return <div className="p-6 text-sm text-red-600">{error || "Failed to load dashboard"}</div>;
  }

  return (
    <DashboardShell
      title="Agent Dashboard"
      subtitle="Focus on the highest-intent leads and close faster."
      kpis={
        <>
          <KpiCard label="New Leads" value={String(data.kpis.newLeads)} />
          <KpiCard label="Hot Leads" value={String(data.kpis.hotLeads)} />
          <KpiCard label="Follow-Ups Due" value={String(data.kpis.followUpsDue)} />
          <KpiCard label="Active Deals" value={String(data.kpis.activeDeals)} />
          <KpiCard label="Closed This Month" value={String(data.kpis.closedThisMonth)} />
        </>
      }
    >
      <SectionCard title="Date Range">
        <DateRangeFilter value={range} onChange={setRange} />
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <LineTrendCard title="Lead Trend" data={data.trends.leadsByDay} />
        <BarBreakdownCard title="Pipeline Breakdown" data={data.trends.pipelineBreakdown} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <SectionCard title="Hot Leads / Lead Inbox">
          <div className="space-y-3">
            {data.hotLeads.length === 0 ? (
              <div className="text-sm text-gray-500">No hot leads yet.</div>
            ) : (
              data.hotLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center justify-between rounded-xl border p-4"
                >
                  <div>
                    <div className="font-medium text-gray-900">{lead.name}</div>
                    <div className="text-sm text-gray-500">
                      {lead.city} • Score {lead.score}
                    </div>
                  </div>
                  <div className="text-sm font-medium text-gray-700">{lead.status}</div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title="Alerts">
          <div className="space-y-3">
            {data.alerts.length === 0 ? (
              <div className="text-sm text-gray-500">No alerts right now.</div>
            ) : (
              data.alerts.map((alert, idx) => (
                <div key={idx} className="rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
                  {alert}
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>
    </DashboardShell>
  );
}
