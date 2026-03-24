"use client";

import { useState } from "react";
import { BarBreakdownCard } from "@/components/dashboard/BarBreakdownCard";
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { LineTrendCard } from "@/components/dashboard/LineTrendCard";
import { SectionCard } from "@/components/dashboard/SectionCard";
import type { SupportDashboardResponse } from "@/lib/dashboard/support";
import { getPresetDateRange, type DateRange } from "@/lib/dashboard/dateRange";
import { useDashboardData } from "@/lib/dashboard/useDashboardData";

type SupportDashboardPayload = { success: true } & SupportDashboardResponse;

export function SupportDashboardClient() {
  const [range, setRange] = useState<DateRange>(getPresetDateRange("30d"));

  const { data, loading, error } = useDashboardData<SupportDashboardPayload>(
    "/api/dashboard/support/overview",
    { start: range.start, end: range.end }
  );

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Loading support dashboard...</div>;
  }

  if (error || !data) {
    return <div className="p-6 text-sm text-red-600">{error || "Failed to load dashboard"}</div>;
  }

  return (
    <DashboardShell
      title="System Support Dashboard"
      subtitle="Resolve issues faster and keep the platform running smoothly."
      kpis={
        <>
          <KpiCard label="Open Tickets" value={String(data.kpis.openTickets)} />
          <KpiCard label="Urgent Tickets" value={String(data.kpis.urgentTickets)} />
          <KpiCard
            label="Waiting on Support"
            value={String(data.kpis.waitingOnSupport)}
          />
          <KpiCard
            label="Avg Response Time"
            value={`${data.kpis.avgResponseMinutes}m`}
          />
          <KpiCard label="Resolved Today" value={String(data.kpis.resolvedToday)} />
        </>
      }
    >
      <SectionCard title="Date Range">
        <p className="mb-3 text-xs text-gray-500">Filters tickets by conversation created date.</p>
        <DateRangeFilter value={range} onChange={setRange} />
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <LineTrendCard title="Tickets by day" data={data.trends.ticketsByDay} />
        <BarBreakdownCard title="Issue category breakdown" data={data.trends.issueCategoryBreakdown} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="Ticket Queue">
          <div className="space-y-3">
            {data.ticketQueue.length === 0 ? (
              <div className="text-sm text-gray-500">No tickets in queue.</div>
            ) : (
              data.ticketQueue.map((ticket) => (
                <div
                  key={ticket.publicId}
                  className="flex items-center justify-between rounded-xl border border-gray-100 p-4"
                >
                  <div>
                    <div className="font-medium text-gray-900">{ticket.customerName}</div>
                    <div className="text-sm text-gray-500">{ticket.subject}</div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-medium text-gray-700">{ticket.priority}</div>
                    <div className="text-gray-400">
                      Unread {ticket.unreadForSupport}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title="Quick Actions">
          <div className="grid gap-3">
            <button type="button" className="rounded-xl bg-gray-900 px-4 py-3 text-sm font-medium text-white">
              Assign to Me
            </button>
            <button type="button" className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-900">
              Mark Urgent
            </button>
            <button type="button" className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-900">
              Mark Resolved
            </button>
            <button type="button" className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-900">
              Tag Issue
            </button>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard title="Issue Trends">
          <ul className="space-y-3 text-sm text-gray-700">
            {data.issueTrends.length === 0 ? (
              <li>No issue trend data</li>
            ) : (
              data.issueTrends.map((item) => (
                <li key={item.label}>
                  {item.label} — {item.count}
                </li>
              ))
            )}
          </ul>
        </SectionCard>

        <SectionCard title="Team Workload">
          <ul className="space-y-3 text-sm text-gray-700">
            {data.teamWorkload.length === 0 ? (
              <li>No workload data</li>
            ) : (
              data.teamWorkload.map((item) => (
                <li key={item.agentName}>
                  {item.agentName} — {item.activeTickets} active tickets
                </li>
              ))
            )}
          </ul>
        </SectionCard>
      </div>
    </DashboardShell>
  );
}
