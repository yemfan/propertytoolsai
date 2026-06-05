"use client";

import { defaultAvatarForSeed } from "@helm/ui";
import { getBlueprint } from "@helm/ai-workforce";

type TimData = {
  overdueInvoices: number;
  overdueTotal: string;
  openTasks: number;
  urgentTasks: number;
};

/**
 * Tim's Briefing — a read-only CIO intelligence summary on the Command Center.
 * Tim is "suggest" autonomy: no approval flow, no actions — just surfaces what
 * the data says so the owner can decide what to act on.
 */
export function TimBriefing({ data }: { data: TimData }) {
  const { overdueInvoices, overdueTotal, openTasks, urgentTasks } = data;

  const insights: string[] = [];
  if (overdueInvoices > 0) insights.push(`${overdueInvoices} invoice${overdueInvoices > 1 ? "s" : ""} overdue — ${overdueTotal} uncollected`);
  if (urgentTasks > 0) insights.push(`${urgentTasks} urgent task${urgentTasks > 1 ? "s" : ""} open`);
  else if (openTasks > 0) insights.push(`${openTasks} open task${openTasks > 1 ? "s" : ""} — none urgent`);
  if (insights.length === 0) insights.push("No urgent items — everything looks healthy");

  const avatar = getBlueprint("tim")?.avatar ?? defaultAvatarForSeed("tim");

  return (
    <div className="mt-8 bg-white rounded-2xl border border-slate-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <img
          src={`/avatars/${avatar}.png`}
          alt="Tim"
          className="w-9 h-9 rounded-full object-cover bg-slate-100 flex-shrink-0"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
        <div>
          <p className="text-sm font-semibold text-slate-800">Tim · AI CIO</p>
          <p className="text-xs text-slate-400">Today&apos;s briefing</p>
        </div>
      </div>
      <ul className="space-y-2">
        {insights.map((line, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
            <span className="text-slate-300 mt-0.5 flex-shrink-0">→</span>
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}
