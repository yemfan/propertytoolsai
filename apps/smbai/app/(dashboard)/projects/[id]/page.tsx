import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getProject, type ProjectStatus } from "@/lib/actions/projects";
import { listProjectExpenses } from "@/lib/actions/expenses";
import {
  ArrowLeft, Clock, DollarSign, CheckSquare, TrendingUp, CalendarDays,
} from "lucide-react";
import { ProjectStatusToggle } from "./project-status-toggle";

export const metadata: Metadata = { title: "Project" };

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}
function fmtHrs(mins: number) {
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const COLOR_DOTS: Record<string, string> = {
  indigo: "bg-indigo-500", emerald: "bg-emerald-500", rose: "bg-rose-500",
  amber: "bg-amber-500",  violet: "bg-violet-500",  slate: "bg-slate-400",
};

const STATUS_BADGES: Record<string, string> = {
  active:    "bg-emerald-100 text-emerald-700",
  paused:    "bg-amber-100 text-amber-700",
  completed: "bg-indigo-100 text-indigo-700",
  cancelled: "bg-slate-100 text-slate-500",
};

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = await cookies();
  const orgId = cookieStore.get("smbai-org-id")?.value ?? "";
  const supabase = await createClient();

  const result = await getProject(id);
  if (!result) notFound();

  const { project, stats } = result;

  // Load time entries for this project
  const { data: entries } = await supabase
    .from("time_entries")
    .select("id, description, started_at, duration_minutes, billable, hourly_rate, invoiced, clients(first_name, last_name, company)")
    .eq("organization_id", orgId)
    .eq("project_id", id)
    .not("ended_at", "is", null)
    .order("started_at", { ascending: false })
    .limit(50);

  // Load tasks for this project
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, status, priority, due_date, completed")
    .eq("organization_id", orgId)
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  // Load expenses tagged to this project (Week 27 — project P&L)
  const projectExpenses = await listProjectExpenses(id);

  const clientName = project.clients
    ? [project.clients.first_name, project.clients.last_name].filter(Boolean).join(" ") || project.clients.company || "Client"
    : null;

  const budgetProgress = project.budget_hours && stats.totalMinutes
    ? Math.min(100, (stats.totalMinutes / 60 / project.budget_hours) * 100)
    : null;

  const budgetBurnAmt = project.budget_amount && stats.billableAmount
    ? Math.min(100, (stats.billableAmount / project.budget_amount) * 100)
    : null;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Back */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/projects" className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full flex-shrink-0 ${COLOR_DOTS[project.color] ?? "bg-indigo-500"}`} />
          <h1 className="text-xl font-semibold text-slate-900">{project.name}</h1>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_BADGES[project.status] ?? STATUS_BADGES.active}`}>
            {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
          </span>
        </div>
        <ProjectStatusToggle projectId={id} currentStatus={project.status as ProjectStatus} />
      </div>

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 mb-8">
        {clientName && (
          <span>Client: <span className="text-slate-700 font-medium">{clientName}</span></span>
        )}
        {project.start_date && (
          <span className="flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5" />
            {new Date(project.start_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            {project.end_date && (
              <> → {new Date(project.end_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</>
            )}
          </span>
        )}
        {project.hourly_rate && (
          <span>${project.hourly_rate}/hr</span>
        )}
      </div>

      {project.description && (
        <p className="text-sm text-slate-600 mb-8 bg-slate-50 rounded-xl px-5 py-4">
          {project.description}
        </p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: "Total hours",
            value: fmtHrs(stats.totalMinutes),
            sub: `${fmtHrs(stats.billableMinutes)} billable`,
            icon: <Clock className="w-4 h-4 text-indigo-400" />,
          },
          {
            label: "Billable amount",
            value: fmt(stats.billableAmount),
            sub: `${fmt(stats.invoicedAmount)} invoiced`,
            icon: <DollarSign className="w-4 h-4 text-emerald-400" />,
          },
          {
            label: "Tasks",
            value: `${stats.openTasks} open`,
            sub: `${stats.completedTasks} completed`,
            icon: <CheckSquare className="w-4 h-4 text-amber-400" />,
          },
          {
            label: "Budget used",
            value: project.budget_hours
              ? `${((stats.totalMinutes / 60)).toFixed(1)} / ${project.budget_hours}h`
              : project.budget_amount
              ? `${fmt(stats.billableAmount)} / ${fmt(project.budget_amount)}`
              : "No budget",
            sub: budgetProgress !== null ? `${budgetProgress.toFixed(0)}%` : "",
            icon: <TrendingUp className="w-4 h-4 text-violet-400" />,
          },
        ].map(({ label, value, sub, icon }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
              {icon}
            </div>
            <p className="text-lg font-semibold text-slate-800">{value}</p>
            {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>

      {/* Budget progress bars */}
      {(budgetProgress !== null || budgetBurnAmt !== null) && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-8 space-y-3">
          {budgetProgress !== null && (
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-500 font-medium">Hours budget</span>
                <span className={`font-semibold ${budgetProgress > 90 ? "text-rose-600" : budgetProgress > 75 ? "text-amber-600" : "text-slate-700"}`}>
                  {budgetProgress.toFixed(0)}%
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${budgetProgress > 90 ? "bg-rose-500" : budgetProgress > 75 ? "bg-amber-500" : "bg-indigo-500"}`}
                  style={{ width: `${budgetProgress}%` }}
                />
              </div>
            </div>
          )}
          {budgetBurnAmt !== null && (
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-500 font-medium">Amount budget</span>
                <span className={`font-semibold ${budgetBurnAmt > 90 ? "text-rose-600" : budgetBurnAmt > 75 ? "text-amber-600" : "text-slate-700"}`}>
                  {budgetBurnAmt.toFixed(0)}%
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${budgetBurnAmt > 90 ? "bg-rose-500" : budgetBurnAmt > 75 ? "bg-amber-500" : "bg-emerald-500"}`}
                  style={{ width: `${budgetBurnAmt}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Profitability / P&L (Week 27) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-700">Profitability</h2>
          {stats.margin !== null && (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              stats.profit >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
            }`}>
              {(stats.margin * 100).toFixed(0)}% margin
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Revenue</p>
            <p className="text-lg font-semibold text-slate-800 mt-1">{fmt(stats.revenue)}</p>
            {stats.billableAmount > stats.invoicedAmount && (
              <p className="text-xs text-amber-600 mt-0.5">
                {fmt(stats.billableAmount - stats.invoicedAmount)} unbilled
              </p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Labor cost</p>
            <p className="text-lg font-semibold text-slate-600 mt-1">−{fmt(stats.laborCost)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Expenses</p>
            <p className="text-lg font-semibold text-slate-600 mt-1">−{fmt(stats.expensesTotal)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Profit</p>
            <p className={`text-lg font-semibold mt-1 ${stats.profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {fmt(stats.profit)}
            </p>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-4">
          Revenue counts invoiced billable time. Profit nets labor cost and tagged expenses.
          {stats.laborCost === 0 && (
            <>
              {" "}Set a default labor cost rate in{" "}
              <Link href="/settings" className="text-indigo-600 hover:underline">Settings</Link>
              {" "}to factor labor in.
            </>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Time entries */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Time entries</h2>
            <Link href={`/timesheets`} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
              View all →
            </Link>
          </div>
          {!entries?.length ? (
            <div className="flex flex-col items-center py-10 text-center px-6">
              <Clock className="w-7 h-7 text-slate-300 mb-2" />
              <p className="text-xs text-slate-400">No time entries yet.</p>
              <p className="text-xs text-slate-400 mt-1">Start a timer and tag it to this project.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {entries.slice(0, 10).map((e) => {
                const amt = e.billable && e.hourly_rate && e.duration_minutes
                  ? (e.duration_minutes / 60) * Number(e.hourly_rate)
                  : null;
                return (
                  <div key={e.id} className="flex items-center gap-3 px-5 py-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${e.billable ? "bg-emerald-400" : "bg-slate-300"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 truncate">{e.description || "No description"}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(e.started_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                    {amt !== null && (
                      <span className="text-xs text-emerald-600 font-medium flex-shrink-0">{fmt(amt)}</span>
                    )}
                    <span className="text-xs font-mono text-slate-500 flex-shrink-0">
                      {fmtHrs(e.duration_minutes ?? 0)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tasks */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Tasks</h2>
            <Link href="/tasks" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
              View all →
            </Link>
          </div>
          {!tasks?.length ? (
            <div className="flex flex-col items-center py-10 text-center px-6">
              <CheckSquare className="w-7 h-7 text-slate-300 mb-2" />
              <p className="text-xs text-slate-400">No tasks yet.</p>
              <p className="text-xs text-slate-400 mt-1">Add tasks and tag them to this project.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {tasks.slice(0, 10).map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                  <div className={`w-4 h-4 rounded border-2 flex-shrink-0 ${t.completed ? "bg-indigo-600 border-indigo-600" : "border-slate-300"}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${t.completed ? "line-through text-slate-400" : "text-slate-700"}`}>{t.title}</p>
                    {t.due_date && (
                      <p className="text-xs text-slate-400">
                        Due {new Date(t.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    )}
                  </div>
                  {t.priority && t.priority !== "normal" && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                      t.priority === "urgent" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {t.priority}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Project expenses (Week 27) */}
      <div className="bg-white rounded-xl border border-slate-200 mt-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">Expenses</h2>
          <Link href="/books/expenses/new" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
            Add expense →
          </Link>
        </div>
        {!projectExpenses.length ? (
          <div className="flex flex-col items-center py-10 text-center px-6">
            <DollarSign className="w-7 h-7 text-slate-300 mb-2" />
            <p className="text-xs text-slate-400">No expenses tagged to this project yet.</p>
            <p className="text-xs text-slate-400 mt-1">Pick this project when recording an expense.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {projectExpenses.map((ex) => (
              <div key={ex.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 truncate">{ex.memo || ex.accountName}</p>
                  <p className="text-xs text-slate-400">
                    {new Date(ex.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {ex.accountName}
                  </p>
                </div>
                <span className="text-sm font-medium text-slate-700 flex-shrink-0">{fmt(ex.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
