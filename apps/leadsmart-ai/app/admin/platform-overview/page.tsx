import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { SectionCard } from "@/components/dashboard/SectionCard";

const propertyTopTools = [
  { name: "Home Value Estimate", users: "4,280", conversion: "24.1%" },
  { name: "Mortgage Calculator", users: "3,120", conversion: "18.7%" },
  { name: "AI Property Comparison", users: "1,440", conversion: "31.5%" },
];

const propertyTopPages = [
  { page: "/home-value", visitors: "6,420" },
  { page: "/mortgage-calculator", visitors: "4,980" },
  { page: "/ai-property-comparison", visitors: "2,010" },
];

const leadsmartMetrics = [
  { label: "Active Agents", value: "38" },
  { label: "Lead Assignments", value: "412" },
  { label: "Follow-Up Rate", value: "82%" },
  { label: "Close Rate", value: "11.4%" },
  { label: "MRR", value: "$8,740" },
];

const funnel = [
  { stage: "Visitors", value: 18420 },
  { stage: "Tool Users", value: 9630 },
  { stage: "Leads", value: 1860 },
  { stage: "Qualified Leads", value: 640 },
  { stage: "Assigned Leads", value: 422 },
  { stage: "Closed Deals", value: 48 },
];

const alerts = [
  {
    title: "Home Value conversion down 12%",
    detail: "Past 7 days vs previous 7 days",
  },
  {
    title: "Pasadena traffic up 21%",
    detail: "Strong organic growth from SEO pages",
  },
  {
    title: "Support tickets rising for billing",
    detail: "8 new billing issues in last 24 hours",
  },
  {
    title: "AI Property Comparison converting well",
    detail: "Premium conversion up to 31.5%",
  },
];

const supportStats = [
  { label: "Open Tickets", value: "24" },
  { label: "Urgent Tickets", value: "3" },
  { label: "Avg Response Time", value: "4m" },
  { label: "Resolved Today", value: "17" },
];

function FunnelBar({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const width = `${(value / max) * 100}%`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-900">{label}</span>
        <span className="text-gray-500">{value.toLocaleString()}</span>
      </div>
      <div className="h-3 rounded-full bg-gray-100">
        <div className="h-3 rounded-full bg-gray-900 transition-all" style={{ width }} />
      </div>
    </div>
  );
}

export const metadata = {
  title: "Platform Overview | LeadSmart AI",
  description: "Business performance across PropertyToolsAI and LeadSmart AI.",
};

export default function PlatformOverviewPage() {
  const maxFunnel = funnel[0].value;

  return (
    <DashboardShell
      className="min-h-0 bg-transparent p-0"
      title="Platform Overview"
      subtitle="Business performance across PropertyToolsAI and LeadSmart AI."
      kpiGridClassName="md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
      kpis={
        <>
          <KpiCard label="Total Visitors" value="18,420" subtext="+14.8% MoM" />
          <KpiCard label="Tool Usage" value="9,630" subtext="52.3% visitor engagement" />
          <KpiCard label="Leads Captured" value="1,860" subtext="19.3% of tool users" />
          <KpiCard label="Qualified Leads" value="640" subtext="34.4% of captured leads" />
          <KpiCard label="Paying Agents" value="38" subtext="+6 this month" />
          <KpiCard label="Revenue" value="$8,740" subtext="Current MRR" />
        </>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard title="PropertyToolsAI Performance">
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl bg-gray-50 p-4">
                <div className="text-sm text-gray-500">Traffic</div>
                <div className="mt-2 text-2xl font-semibold text-gray-900">18,420</div>
                <div className="mt-1 text-xs text-gray-400">+14.8% this month</div>
              </div>
              <div className="rounded-xl bg-gray-50 p-4">
                <div className="text-sm text-gray-500">Lead Conversion</div>
                <div className="mt-2 text-2xl font-semibold text-gray-900">10.1%</div>
                <div className="mt-1 text-xs text-gray-400">Visitor to lead</div>
              </div>
              <div className="rounded-xl bg-gray-50 p-4">
                <div className="text-sm text-gray-500">Premium Upgrades</div>
                <div className="mt-2 text-2xl font-semibold text-gray-900">146</div>
                <div className="mt-1 text-xs text-gray-400">+18.2% this month</div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900">Top Tools</h3>
              <div className="mt-3 space-y-3">
                {propertyTopTools.map((tool) => (
                  <div key={tool.name} className="flex items-center justify-between rounded-xl border p-4">
                    <div>
                      <div className="font-medium text-gray-900">{tool.name}</div>
                      <div className="text-sm text-gray-500">{tool.users} users</div>
                    </div>
                    <div className="text-sm font-medium text-gray-700">{tool.conversion} conversion</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900">Top Landing Pages</h3>
              <div className="mt-3 space-y-3">
                {propertyTopPages.map((page) => (
                  <div key={page.page} className="flex items-center justify-between rounded-xl border p-4">
                    <div className="font-medium text-gray-900">{page.page}</div>
                    <div className="text-sm text-gray-500">{page.visitors} visitors</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="LeadSmart AI Performance">
          <div className="grid gap-4 md:grid-cols-2">
            {leadsmartMetrics.map((metric) => (
              <div key={metric.label} className="rounded-xl bg-gray-50 p-4">
                <div className="text-sm text-gray-500">{metric.label}</div>
                <div className="mt-2 text-2xl font-semibold text-gray-900">{metric.value}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Funnel Overview">
        <div className="grid gap-5">
          {funnel.map((item) => (
            <FunnelBar key={item.stage} label={item.stage} value={item.value} max={maxFunnel} />
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard title="Support / Operations">
          <div className="grid gap-4 md:grid-cols-2">
            {supportStats.map((stat) => (
              <div key={stat.label} className="rounded-xl bg-gray-50 p-4">
                <div className="text-sm text-gray-500">{stat.label}</div>
                <div className="mt-2 text-2xl font-semibold text-gray-900">{stat.value}</div>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-900">Issue Categories</h3>
            <div className="mt-3 space-y-3">
              {[
                ["Billing", "8"],
                ["Login / Access", "5"],
                ["Home Value Tool", "4"],
                ["Lead Routing", "3"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-xl border p-4">
                  <div className="font-medium text-gray-900">{label}</div>
                  <div className="text-sm text-gray-500">{value} issues</div>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Alerts / Insights">
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div key={alert.title} className="rounded-xl border bg-gray-50 p-4">
                <div className="font-medium text-gray-900">{alert.title}</div>
                <div className="mt-1 text-sm text-gray-500">{alert.detail}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </DashboardShell>
  );
}
