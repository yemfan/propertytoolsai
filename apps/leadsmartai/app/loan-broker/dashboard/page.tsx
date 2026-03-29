import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { SectionCard } from "@/components/dashboard/SectionCard";

const borrowers = [
  { name: "Kevin Wu", loan: "$780K", readiness: "High", status: "Pre-Qualified" },
  { name: "Amy Zhao", loan: "$620K", readiness: "Medium", status: "Docs Pending" },
  { name: "Jason Li", loan: "$1.1M", readiness: "High", status: "Application" },
];

export const metadata = {
  title: "Loan Broker Dashboard | LeadSmart AI",
  description: "Borrower queue, loan pipeline, and AI finance tools.",
};

export default function LoanBrokerDashboardPage() {
  return (
    <DashboardShell
      title="Loan Broker Dashboard"
      subtitle="Track borrower readiness and move applications forward faster."
      kpis={
        <>
          <KpiCard label="New Financing Leads" value="18" subtext="+5 today" />
          <KpiCard label="Pre-Qualified" value="9" subtext="Ready to engage" />
          <KpiCard label="Applications In Progress" value="7" subtext="2 in underwriting" />
          <KpiCard label="Docs Pending" value="6" subtext="Need action" />
          <KpiCard label="Funded This Month" value="3" subtext="$2.4M total" />
        </>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <SectionCard title="Borrower Queue">
          <div className="space-y-3">
            {borrowers.map((b) => (
              <div key={b.name} className="flex items-center justify-between rounded-xl border p-4">
                <div>
                  <div className="font-medium text-gray-900">{b.name}</div>
                  <div className="text-sm text-gray-500">
                    {b.loan} · Readiness {b.readiness}
                  </div>
                </div>
                <div className="text-sm font-medium text-gray-700">{b.status}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="AI Finance Tools">
          <div className="grid gap-3">
            <button className="rounded-xl bg-gray-900 px-4 py-3 text-sm font-medium text-white">
              Generate Affordability Summary
            </button>
            <button className="rounded-xl border px-4 py-3 text-sm font-medium text-gray-900">
              Compare Loan Scenarios
            </button>
            <button className="rounded-xl border px-4 py-3 text-sm font-medium text-gray-900">
              Draft Borrower Follow-Up
            </button>
            <button className="rounded-xl border px-4 py-3 text-sm font-medium text-gray-900">
              Scan Refinance Opportunity
            </button>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard title="Loan Pipeline">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            {[
              ["Inquiry", 18],
              ["Pre-Qual", 9],
              ["App Started", 7],
              ["Docs", 6],
              ["UW", 3],
              ["Funded", 3],
            ].map(([label, count]) => (
              <div key={String(label)} className="rounded-xl bg-gray-50 p-4 text-center">
                <div className="text-xs text-gray-500">{label}</div>
                <div className="mt-2 text-xl font-semibold">{count}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Missing Docs">
          <ul className="space-y-3 text-sm text-gray-700">
            <li>Amy Zhao - pay stub missing</li>
            <li>Kevin Wu - 2 months bank statements needed</li>
            <li>Jason Li - tax return requested</li>
          </ul>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard title="Tasks">
          <ul className="space-y-3 text-sm text-gray-700">
            <li>Review Jason Li application package</li>
            <li>Call Amy Zhao about missing documents</li>
            <li>Run refinance scenario for recent inquiry</li>
          </ul>
        </SectionCard>

        <SectionCard title="Recent Borrower Activity">
          <ul className="space-y-3 text-sm text-gray-700">
            <li>Borrower reopened affordability report</li>
            <li>Scenario comparison viewed twice</li>
            <li>High-intent refinance lead entered queue</li>
          </ul>
        </SectionCard>
      </div>
    </DashboardShell>
  );
}
