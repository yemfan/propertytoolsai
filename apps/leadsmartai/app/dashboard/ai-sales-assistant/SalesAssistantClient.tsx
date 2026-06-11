"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getAssistant } from "@/lib/realtorboss/team";
import { LeadProfileDrawer } from "@/components/realtorboss/LeadProfileDrawer";
import { AssistantHeader, AssistantKpiCard } from "@/components/realtorboss/AssistantPage";

type SummaryMetrics = {
  totalLeads: number;
  hotLeads: number;
  inactive7Days: number;
  messagesSent: number;
};

type Lead = {
  id: string;
  name: string | null;
  rating: string | null;
  source: string | null;
  engagement_score: number | null;
  last_activity_at: string | null;
  ai_intent: string | null;
};

const assistant = getAssistant("sales_assistant");

export default function SalesAssistantClient() {
  const [metrics, setMetrics] = useState<SummaryMetrics | null>(null);
  const [hotLeads, setHotLeads] = useState<Lead[]>([]);
  const [quietLeads, setQuietLeads] = useState<Lead[]>([]);
  const [profileLeadId, setProfileLeadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [summaryRes, hotRes, quietRes] = await Promise.all([
      fetch("/api/dashboard/summary").then((r) => r.json()).catch(() => ({})),
      fetch("/api/dashboard/leads?filter=hot&pageSize=8").then((r) => r.json()).catch(() => ({})),
      fetch("/api/dashboard/leads?filter=inactive&pageSize=8").then((r) => r.json()).catch(() => ({})),
    ]);
    const m = summaryRes?.metrics;
    if (m) {
      setMetrics({
        totalLeads: m.totalLeads ?? 0,
        hotLeads: m.hotLeads ?? 0,
        inactive7Days: m.inactive7Days ?? 0,
        messagesSent: m.messagesSent ?? 0,
      });
    }
    setHotLeads((hotRes?.leads ?? []) as Lead[]);
    setQuietLeads((quietRes?.leads ?? []) as Lead[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-4">
      <AssistantHeader
        assistant={assistant}
        actions={[
          { label: "Lead queue", href: "/dashboard/lead-queue" },
          { label: "Conversations", href: "/dashboard/inbox" },
          { label: "Outbound calls", href: "/dashboard/missed-call" },
          { label: "Manage", href: "/dashboard/ai-team" },
        ]}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AssistantKpiCard label="Hot leads identified" value={loading ? undefined : metrics?.hotLeads} tone="hot" />
        <AssistantKpiCard label="Quiet leads to revive" value={loading ? undefined : metrics?.inactive7Days} hint="7+ days inactive" tone={metrics && metrics.inactive7Days > 0 ? "warn" : undefined} />
        <AssistantKpiCard label="Total leads" value={loading ? undefined : metrics?.totalLeads} />
        <AssistantKpiCard label="Messages sent" value={loading ? undefined : metrics?.messagesSent} hint="all time" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <LeadList
          title="Hot leads — call these first"
          leads={hotLeads}
          loading={loading}
          empty="No hot leads right now."
          viewAllHref="/dashboard/leads?filter=hot"
          onOpenLead={setProfileLeadId}
        />
        <LeadList
          title="Reactivation queue — quiet for 7+ days"
          leads={quietLeads}
          loading={loading}
          empty="No quiet leads — everyone has recent activity."
          viewAllHref="/dashboard/leads?filter=inactive"
          onOpenLead={setProfileLeadId}
        />
      </div>

      <LeadProfileDrawer leadId={profileLeadId} onClose={() => setProfileLeadId(null)} />
    </div>
  );
}

function LeadList({
  title,
  leads,
  loading,
  empty,
  viewAllHref,
  onOpenLead,
}: {
  title: string;
  leads: Lead[];
  loading: boolean;
  empty: string;
  viewAllHref: string;
  onOpenLead: (id: string) => void;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        <Link href={viewAllHref} className="text-xs font-medium text-blue-600 hover:text-blue-800">View all</Link>
      </div>
      {leads.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">{loading ? "Loading…" : empty}</p>
      ) : (
        <div className="space-y-2">
          {leads.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => onOpenLead(l.id)}
              className="flex w-full items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-left hover:bg-gray-50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">{l.name ?? "Unnamed lead"}</p>
                <p className="truncate text-xs text-gray-500">
                  {[l.ai_intent, l.source].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              {typeof l.engagement_score === "number" && (
                <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">{l.engagement_score}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
