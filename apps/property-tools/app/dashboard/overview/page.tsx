import Link from "next/link";
import Card from "@/components/ui/Card";
import { getCurrentAgentContext, getLeadUsageThisMonth } from "@/lib/dashboardService";
import { supabaseServer } from "@/lib/supabaseServer";
import SendDailyBriefingButton from "@/components/dashboard/SendDailyBriefingButton";
import TasksFromBriefing from "@/components/dashboard/TasksFromBriefing";

function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default async function OverviewPage() {
  const [usage, ctx] = await Promise.all([getLeadUsageThisMonth(), getCurrentAgentContext()]);
  const todayIso = startOfTodayIso();

  const { data: leads } = await supabaseServer
    .from("leads")
    .select("id,rating,engagement_score,last_activity_at")
    .eq("agent_id", ctx.agentId)
    .limit(500);
  const leadRows = (leads as any[]) ?? [];
  const leadIds = leadRows.map((l) => Number(l.id));

  const totalLeads = leadRows.length;
  const hotLeads = leadRows.filter((l) => String(l.rating ?? "").toLowerCase() === "hot").length;
  const scores = leadRows
    .map((l) => Number(l.engagement_score ?? 0))
    .filter((n) => Number.isFinite(n));
  const avgEngagementScore = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;
  const inactive7Days = leadRows.filter((l) => {
    if (!l.last_activity_at) return false;
    const ms = new Date(String(l.last_activity_at)).getTime();
    return ms <= Date.now() - 7 * 24 * 60 * 60 * 1000;
  }).length;

  let leadsViewedReportsToday = 0;
  let events: any[] = [];
  if (leadIds.length) {
    const { data: reportEvents } = await supabaseServer
      .from("lead_events")
      .select("lead_id,event_type,created_at")
      .eq("event_type", "report_view")
      .gte("created_at", todayIso)
      .in("lead_id", leadIds);
    leadsViewedReportsToday = new Set(((reportEvents as any[]) ?? []).map((e) => Number(e.lead_id)))
      .size;

    const { data: recentEvents } = await supabaseServer
      .from("lead_events")
      .select("id,lead_id,event_type,created_at")
      .in("lead_id", leadIds)
      .order("created_at", { ascending: false })
      .limit(30);
    events = (recentEvents as any[]) ?? [];
  }

  const { count: commCount } = await supabaseServer
    .from("communications")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", ctx.agentId);
  const messagesSent = commCount ?? 0;

  const { data: briefing } = await supabaseServer
    .from("daily_briefings")
    .select("id,summary,insights,created_at")
    .eq("agent_id", ctx.agentId)
    .gte("created_at", todayIso)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let tasksDoneToday = 0;
  let tasksPending = 0;
  try {
    const { count: doneCount } = await supabaseServer
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", ctx.agentId)
      .eq("status", "done")
      .gte("updated_at", todayIso);
    const { count: pendingCount } = await supabaseServer
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", ctx.agentId)
      .eq("status", "pending");
    tasksDoneToday = doneCount ?? 0;
    tasksPending = pendingCount ?? 0;
  } catch {
    // tasks table may not exist yet
  }
  const tasksTotal = tasksDoneToday + tasksPending;
  const tasksCompletionRate =
    tasksTotal > 0 ? Math.round((tasksDoneToday / tasksTotal) * 100) : 0;

  const metrics = {
    totalLeads,
    hotLeads,
    avgEngagementScore,
    messagesSent,
    leadsViewedReportsToday,
    inactive7Days,
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading ui-page-title text-brand-text">Dashboard Overview</h1>
        <p className="ui-page-subtitle text-brand-text/80">
          Track your pipeline, marketing activity, and open house attendees in one place.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/dashboard/leads" className="block">
          <Card variant="interactive" className="h-full p-5">
            <div className="ui-card-subtitle text-slate-500">Total Leads</div>
            <div className="mt-2 font-heading text-3xl font-extrabold text-brand-text">{metrics.totalLeads ?? 0}</div>
          </Card>
        </Link>

        <Link href="/dashboard/leads?filter=hot" className="block">
          <Card variant="interactive" className="h-full p-5">
            <div className="ui-card-subtitle text-slate-500">🔥 Hot leads</div>
            <div className="mt-2 font-heading text-3xl font-extrabold text-brand-text">{metrics.hotLeads ?? 0}</div>
          </Card>
        </Link>

        <Link href="/dashboard/leads?filter=high_engagement" className="block">
          <Card variant="interactive" className="h-full p-5">
            <div className="ui-card-subtitle text-slate-500">👀 Leads viewed reports today</div>
            <div className="mt-2 font-heading text-3xl font-extrabold text-brand-text">
              {metrics.leadsViewedReportsToday ?? 0}
            </div>
          </Card>
        </Link>

        <Link href="/dashboard/leads?filter=inactive" className="block">
          <Card variant="interactive" className="h-full p-5">
            <div className="ui-card-subtitle text-slate-500">⏳ Inactive 7+ days</div>
            <div className="mt-2 font-heading text-3xl font-extrabold text-brand-text">{metrics.inactive7Days ?? 0}</div>
          </Card>
        </Link>
      </div>

      <Card className="flex flex-wrap items-center gap-4 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Tasks today
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-brand-success">{tasksDoneToday}</span>
          <span className="text-slate-400">done</span>
          <span className="text-slate-300">/</span>
          <span className="text-2xl font-bold text-brand-text">{tasksPending}</span>
          <span className="text-slate-400">pending</span>
        </div>
        {tasksTotal > 0 && (
          <div className="text-sm text-slate-600">
            Completion rate: <span className="font-semibold">{tasksCompletionRate}%</span>
          </div>
        )}
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-brand-text">Today&apos;s AI Briefing</div>
          <SendDailyBriefingButton />
        </div>
        {briefing ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-700 whitespace-pre-line">{String((briefing as any).summary ?? "")}</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Top leads</div>
                <div className="mt-2 text-xs text-slate-700 space-y-1">
                  {(((briefing as any).insights?.topHotLeads ?? []) as any[]).slice(0, 3).map((l, i) => (
                    <div key={`${l.name}-${i}`}>{l.name} ({l.score ?? 0})</div>
                  ))}
                  {!((briefing as any).insights?.topHotLeads ?? []).length ? <div>None yet</div> : null}
                </div>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</div>
                <ul className="mt-2 text-xs text-slate-700 list-disc pl-4 space-y-1">
                  {(((briefing as any).insights?.suggestedActions ?? []) as any[]).slice(0, 4).map((a, i) => (
                    <li key={`${a}-${i}`}>{a}</li>
                  ))}
                  {!((briefing as any).insights?.suggestedActions ?? []).length ? <li>No actions generated yet.</li> : null}
                </ul>
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Tasks from briefing
              </div>
              <TasksFromBriefing />
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            No briefing generated yet for today. Click <span className="font-semibold">Generate now</span>.
          </p>
        )}
      </Card>

      <Card className="space-y-4 p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-brand-text">Quick Actions</div>
            <div className="text-xs text-brand-text/80 mt-1">
              Launch the most common workflows without leaving the portal.
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link
              href="/smart-cma-builder?save=1"
              className="inline-flex items-center justify-center rounded-xl bg-[#0072ce] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#005ca8]"
            >
              Create Report
            </Link>
            <Link
              href="/dashboard/leads"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Add Lead
            </Link>
            <Link
              href="/dashboard/open-houses"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Create Open House
            </Link>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="text-sm font-semibold text-slate-900">Recent Activity</div>
            <div className="text-xs text-slate-600">
              Plan: <span className="font-semibold">{usage.planType.toUpperCase()}</span>
              {" · "}Leads used: <span className="font-semibold">{usage.used}</span>
              {Number.isFinite(usage.limit) ? ` / ${usage.limit}` : ""}
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {events.length ? (
              events.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center justify-between gap-3 border border-slate-100 rounded-lg px-3 py-2 text-xs"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-800">
                      {String(ev.event_type).replace("_", " ")}
                    </span>
                    <span className="text-slate-500">
                      Lead #{String(ev.lead_id ?? "—")}
                    </span>
                  </div>
                  <div className="text-slate-500 whitespace-nowrap">
                    {ev.created_at ? new Date(ev.created_at).toLocaleString() : "—"}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-600">No recent engagement yet.</p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

