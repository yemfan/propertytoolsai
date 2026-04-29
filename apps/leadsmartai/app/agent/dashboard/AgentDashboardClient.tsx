"use client";

import { CoachingProgramsCard } from "@/components/coaching/CoachingProgramsCard";
import {
  ActionButton,
  DashboardShell,
  DashboardTable,
  KpiCard,
  kpiSubtext,
  PriorityBadge,
  SectionCard,
  StatusBadge,
} from "@/components/platform-dashboard";
import {
  agentActivity,
  agentAlerts,
  agentKpis,
  agentLeads,
  agentPipelineStages,
  agentTasks,
} from "@/lib/platform-dashboard-demo-data";
import { Activity, AlertTriangle, Bot, Inbox, Kanban } from "lucide-react";

function leadStatusTone(s: string): "success" | "warning" | "info" {
  if (s === "Hot") return "success";
  if (s === "Warm") return "warning";
  return "info";
}

export default function AgentDashboardClient() {
  return (
    <DashboardShell
      title="Agent command center"
      subtitle="Lead inbox, AI actions, and pipeline control in one execution view."
      kpis={agentKpis.map((k) => (
        <KpiCard key={k.label} label={k.label} value={k.value} subtext={kpiSubtext(k)} />
      ))}
    >
        <CoachingProgramsCard />
        <section className="grid gap-6 xl:grid-cols-12">
          <SectionCard
            title="Hot leads / lead inbox"
            className="xl:col-span-8"
            action={<ActionButton variant="primary">Open queue</ActionButton>}
          >
            <DashboardTable
              columns={[
                { key: "name", header: "Lead" },
                { key: "city", header: "City" },
                {
                  key: "score",
                  header: "Score",
                  cell: (r) => <span className="font-semibold tabular-nums text-slate-900">{String(r.score)}</span>,
                },
                {
                  key: "status",
                  header: "Status",
                  cell: (r) => <StatusBadge tone={leadStatusTone(String(r.status))}>{String(r.status)}</StatusBadge>,
                },
                {
                  key: "actions",
                  header: "Actions",
                  cell: () => (
                    <div className="flex gap-1">
                      <ActionButton variant="ghost" className="h-8 px-2.5 text-xs">
                        Quick reply
                      </ActionButton>
                      <ActionButton variant="ghost" className="h-8 px-2.5 text-xs">
                        Assign
                      </ActionButton>
                      <ActionButton variant="ghost" className="h-8 px-2.5 text-xs">
                        Open
                      </ActionButton>
                    </div>
                  ),
                },
              ]}
              rows={agentLeads as unknown as Record<string, unknown>[]}
            />
          </SectionCard>

          <SectionCard title="AI actions" className="xl:col-span-4">
            <div className="grid gap-2">
              {[
                { label: "Send AI follow-up", icon: Bot },
                { label: "Generate comparison", icon: Kanban },
                { label: "Draft message", icon: Inbox },
                { label: "Generate CMA summary", icon: Activity },
              ].map((a) => (
                <ActionButton
                  key={a.label}
                  variant="secondary"
                  className="w-full justify-start rounded-xl px-3.5 py-3 text-left"
                  leftIcon={<a.icon className="h-4 w-4 text-emerald-700" />}
                >
                  {a.label}
                </ActionButton>
              ))}
            </div>
          </SectionCard>
        </section>

        <section className="grid gap-6 xl:grid-cols-12">
          <SectionCard title="Pipeline snapshot" className="xl:col-span-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {agentPipelineStages.map((s) => (
                <div key={s.id} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 ring-1 ring-slate-900/[0.02]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{s.label}</p>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200/80">
                      {s.count}
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white ring-1 ring-slate-200/80">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${Math.round(s.pct * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Alerts" className="xl:col-span-4">
            <ul className="space-y-3">
              {agentAlerts.map((a, i) => (
                <li key={i} className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3 ring-1 ring-slate-900/[0.02]">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{a.title}</p>
                    <p className="mt-0.5 text-xs text-slate-600">{a.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        </section>

        <section className="grid gap-6 xl:grid-cols-12">
          <SectionCard title="Tasks / follow-up due" className="xl:col-span-8">
            <ul className="space-y-2">
              {agentTasks.map((t, i) => (
                <li key={i} className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2.5">
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${t.done ? "text-slate-400 line-through" : "text-slate-900"}`}>{t.title}</p>
                    <p className="text-xs text-slate-500">{t.due}</p>
                  </div>
                  <PriorityBadge level={t.done ? "low" : "medium"} />
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="Recent activity" className="xl:col-span-4">
            <ul className="space-y-3">
              {agentActivity.map((a, i) => (
                <li key={i} className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{a.action}</p>
                    <p className="text-xs text-slate-600">{a.target}</p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">{a.time}</span>
                </li>
              ))}
            </ul>
          </SectionCard>
        </section>
    </DashboardShell>
  );
}

