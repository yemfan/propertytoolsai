"use client";

import { useState } from "react";
import { BarBreakdownCard } from "@/components/dashboard/BarBreakdownCard";
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { LineTrendCard } from "@/components/dashboard/LineTrendCard";
import { SectionCard } from "@/components/dashboard/SectionCard";
import type { LoanBrokerDashboardResponse } from "@/lib/dashboard/loanBroker";
import { getPresetDateRange, type DateRange } from "@/lib/dashboard/dateRange";
import { useDashboardData } from "@/lib/dashboard/useDashboardData";

type LoanBrokerDashboardPayload = { success: true } & LoanBrokerDashboardResponse;

export function LoanBrokerDashboardClient() {
  const [range, setRange] = useState<DateRange>(getPresetDateRange("30d"));

  const { data, loading, error } = useDashboardData<LoanBrokerDashboardPayload>(
    "/api/dashboard/loan-broker/overview",
    { start: range.start, end: range.end }
  );

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Loading loan broker dashboard...</div>;
  }

  if (error || !data) {
    return <div className="p-6 text-sm text-red-600">{error || "Failed to load dashboard"}</div>;
  }

  return (
    <DashboardShell
      title="Loan Broker Dashboard"
      subtitle="Track borrower readiness and move applications forward faster."
      kpis={
        <>
          <KpiCard label="New Financing Leads" value={String(data.kpis.newFinancingLeads)} />
          <KpiCard label="Pre-Qualified" value={String(data.kpis.preQualified)} />
          <KpiCard
            label="Applications In Progress"
            value={String(data.kpis.applicationsInProgress)}
          />
          <KpiCard label="Docs Pending" value={String(data.kpis.docsPending)} />
          <KpiCard label="Funded This Month" value={String(data.kpis.fundedThisMonth)} />
        </>
      }
    >
      <SectionCard title="Date Range">
        <p className="mb-3 text-xs text-gray-500">Filters applications by created date.</p>
        <DateRangeFilter value={range} onChange={setRange} />
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <LineTrendCard title="Applications by day" data={data.trends.applicationsByDay} />
        <BarBreakdownCard title="Pipeline stage breakdown" data={data.trends.pipelineBreakdown} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <SectionCard title="Borrower Queue">
          <div className="space-y-3">
            {data.borrowers.length === 0 ? (
              <div className="text-sm text-gray-500">No borrowers in queue.</div>
            ) : (
              data.borrowers.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between rounded-xl border border-gray-100 p-4"
                >
                  <div>
                    <div className="font-medium text-gray-900">{b.name}</div>
                    <div className="text-sm text-gray-500">
                      ${b.loanAmount.toLocaleString()} • Readiness {b.readiness}
                    </div>
                  </div>
                  <div className="text-sm font-medium text-gray-700">{b.status}</div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title="AI Finance Tools">
          <div className="grid gap-3">
            <button type="button" className="rounded-xl bg-gray-900 px-4 py-3 text-sm font-medium text-white">
              Generate Affordability Summary
            </button>
            <button type="button" className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-900">
              Compare Loan Scenarios
            </button>
            <button type="button" className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-900">
              Draft Borrower Follow-Up
            </button>
            <button type="button" className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-900">
              Scan Refinance Opportunity
            </button>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard title="Loan Pipeline">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {data.pipeline.map((item) => (
              <div key={item.stage} className="rounded-xl bg-gray-50 p-4 text-center">
                <div className="text-xs text-gray-500">{item.stage}</div>
                <div className="mt-2 text-xl font-semibold tabular-nums">{item.count}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Missing Docs">
          <ul className="space-y-3 text-sm text-gray-700">
            {data.missingDocs.length === 0 ? (
              <li>No missing documents right now</li>
            ) : (
              data.missingDocs.map((doc, idx) => <li key={idx}>{doc}</li>)
            )}
          </ul>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard title="Tasks">
          <ul className="space-y-3 text-sm text-gray-700">
            <li>Review borrower queue</li>
            <li>Follow up on applications in progress</li>
            <li>Resolve missing documents</li>
          </ul>
        </SectionCard>

        <SectionCard title="Recent Borrower Activity">
          <ul className="space-y-3 text-sm text-gray-700">
            {data.recentActivity.length === 0 ? (
              <li>No recent activity</li>
            ) : (
              data.recentActivity.map((item, idx) => <li key={idx}>{item}</li>)
            )}
          </ul>
        </SectionCard>
      </div>
    </DashboardShell>
  );
}
