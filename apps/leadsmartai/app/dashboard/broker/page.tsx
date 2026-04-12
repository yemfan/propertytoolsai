import Link from "next/link";
import { getCurrentAgentContext, getLeadUsageThisMonth } from "@/lib/dashboardService";
import { supabaseServer } from "@/lib/supabaseServer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Broker Dashboard",
  description: "Brokerage pipeline, growth tools, and team performance.",
  keywords: ["broker", "brokerage", "pipeline"],
  robots: { index: false },
};

/**
 * Brokerage home — leadership-focused entry to pipeline, growth, and marketing.
 * Requires an `agents` row (same as the rest of `/dashboard/*`).
 */
export default async function BrokerDashboardPage() {
  const [usage, ctx] = await Promise.all([getLeadUsageThisMonth(), getCurrentAgentContext()]);

  const { data: leads } = await supabaseServer
    .from("leads")
    .select("id,rating")
    .eq("agent_id", ctx.agentId)
    .limit(500);
  const leadRows = (leads as { id: unknown; rating?: string | null }[]) ?? [];
  const totalLeads = leadRows.length;
  const hotLeads = leadRows.filter((l) => String(l.rating ?? "").toLowerCase() === "hot").length;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Brokerage</p>
        <h1 className="ui-page-title text-brand-text">Broker dashboard</h1>
        <p className="ui-page-subtitle text-brand-text/80">
          Organization-wide pipeline snapshot, growth tools, and campaigns — open the full CRM anytime from the
          sidebar.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Link
          href="/dashboard/leads"
          className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 hover:border-brand-primary/40 hover:shadow-md transition"
        >
          <div className="ui-card-subtitle text-slate-500">Team leads</div>
          <div className="mt-2 text-3xl font-extrabold text-brand-text">{totalLeads}</div>
        </Link>
        <Link
          href="/dashboard/leads?filter=hot"
          className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 hover:border-brand-accent/40 hover:shadow-md transition"
        >
          <div className="ui-card-subtitle text-slate-500">Hot leads</div>
          <div className="mt-2 text-3xl font-extrabold text-brand-text">{hotLeads}</div>
        </Link>
        <Link
          href="/dashboard/growth"
          className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 hover:border-emerald-300/60 hover:shadow-md transition"
        >
          <div className="ui-card-subtitle text-slate-500">Growth &amp; SEO</div>
          <div className="mt-2 text-sm font-semibold text-brand-text">Traffic &amp; landing tools →</div>
        </Link>
        <Link
          href="/dashboard/marketing"
          className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 hover:border-violet-300/60 hover:shadow-md transition"
        >
          <div className="ui-card-subtitle text-slate-500">Marketing</div>
          <div className="mt-2 text-sm font-semibold text-brand-text">Campaigns &amp; assets →</div>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/dashboard/opportunities"
          className="flex flex-col rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-brand-primary/40 hover:shadow-md"
        >
          <span className="text-sm font-semibold text-brand-text">Lead marketplace</span>
          <span className="mt-1 text-xs text-brand-text/80">Purchase and assign high-intent opportunities.</span>
        </Link>
        <Link
          href="/dashboard/overview"
          className="flex flex-col rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md"
        >
          <span className="text-sm font-semibold text-brand-text">Agent-style overview</span>
          <span className="mt-1 text-xs text-brand-text/80">
            Same briefing &amp; activity view agents use — tasks, AI briefing, recent events.
          </span>
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-xs text-slate-600">
        Plan: <span className="font-semibold text-slate-900">{String(usage.planType ?? "").toUpperCase()}</span>
        {" · "}Lead usage this month:{" "}
        <span className="font-semibold text-slate-900">
          {usage.used}
          {Number.isFinite(usage.limit) ? ` / ${usage.limit}` : ""}
        </span>
      </div>
    </div>
  );
}
