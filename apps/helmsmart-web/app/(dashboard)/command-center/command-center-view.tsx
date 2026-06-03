"use client";

import type { WorkforceSummary } from "@helm/dna-intelligence";
import { CommandCenterGrid, type DnaNode } from "@/components/shell/CommandCenterGrid";

/** "calls_answered" → "Calls Answered". */
function humanize(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * The DNA module nodes on the executive grid. The AI Workforce node is fed live
 * from the workforce roll-up; the rest link into their live sections today and
 * gain KPIs as each module's Command Center `getHealth` feed is wired.
 */
const MODULE_NODES: { id: string; label: string; drillHref?: string; live: boolean }[] = [
  { id: "finance",       label: "Finance",       drillHref: "/books",     live: true },
  { id: "revenue",       label: "Revenue",       drillHref: "/pipeline",  live: true },
  { id: "communication", label: "Communication", drillHref: "/inbox",     live: true },
  { id: "marketing",     label: "Marketing",     drillHref: "/marketing", live: true },
  { id: "operations",    label: "Operations",    drillHref: "/tasks",     live: true },
  { id: "service",       label: "Service",       drillHref: "/reception", live: true },
  { id: "intelligence",  label: "Intelligence",  drillHref: "/reports",   live: true },
  { id: "people",        label: "People",        live: false },
  { id: "knowledge",     label: "Knowledge",     live: false },
];

export function CommandCenterView({ summary }: { summary: WorkforceSummary }) {
  const totalEntries = Object.entries(summary.totals).sort((a, b) => b[1] - a[1]);
  const workforceKpis = totalEntries.slice(0, 3).map(([k, v]) => ({ label: humanize(k), value: v }));
  const totalActions = totalEntries.reduce((sum, [, v]) => sum + v, 0);
  const employeeCount = summary.employees.length;

  const nodes: DnaNode[] = [
    {
      id: "ai-workforce",
      label: "AI Workforce",
      status: employeeCount > 0 ? "ok" : "unconfigured",
      kpis: workforceKpis.length > 0 ? workforceKpis : [{ label: "Employees", value: employeeCount || null }],
    },
    ...MODULE_NODES.map((m): DnaNode => ({
      id: m.id,
      label: m.label,
      status: m.live ? "ok" : "unconfigured",
      kpis: [{ label: "Health", value: null }],
      drillHref: m.drillHref,
    })),
  ];

  const briefing =
    employeeCount === 0
      ? "Hire your AI workforce to activate the Command Center. Once your employees are on, their activity and department KPIs roll up here."
      : `Your AI workforce completed ${totalActions.toLocaleString()} action${totalActions === 1 ? "" : "s"} over the last 30 days across ${employeeCount} employee${employeeCount === 1 ? "" : "s"}. Department health metrics are rolling out module by module.`;

  return <CommandCenterGrid nodes={nodes} briefing={briefing} />;
}
