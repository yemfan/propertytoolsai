import { getCurrentAgentContext, getLeadUsageThisMonth } from "@/lib/dashboardService";
import { supabaseServer } from "@/lib/supabaseServer";
import { AgentHomeDashboard } from "@/components/dashboard/agent-portal/AgentHomeDashboard";
import SendDailyBriefingButton from "@/components/dashboard/SendDailyBriefingButton";
import TasksFromBriefing from "@/components/dashboard/TasksFromBriefing";
import { UpgradeBanner } from "@/components/upsell/UpgradeBanner";
import { getLatestDigest } from "@/lib/digest/digestBuilder";

function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function clipText(s: string, max: number) {
  const t = s.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function hotLeadSubtitle(
  row: Record<string, unknown>,
  latestMessage?: string
): string | undefined {
  const msg = latestMessage?.trim();
  if (msg) return clipText(msg, 160);
  const intent = String(row.likely_intent ?? "").trim();
  if (intent) return clipText(intent, 160);
  return undefined;
}

export default async function OverviewPage() {
  const [usage, ctx] = await Promise.all([getLeadUsageThisMonth(), getCurrentAgentContext()]);
  const todayIso = startOfTodayIso();

  const { data: profileRow } = await supabaseServer
    .from("user_profiles")
    .select("full_name")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  const greetingName =
    String((profileRow as { full_name?: string | null } | null)?.full_name ?? "")
      .trim()
      .split(/\s+/)[0] ?? "";

  const { data: leads } = await supabaseServer
    .from("leads")
    .select("id,name,rating,engagement_score,last_activity_at,likely_intent")
    .eq("agent_id", ctx.agentId)
    .limit(500);
  const leadRows = (leads as Record<string, unknown>[]) ?? [];

  const hotRows = leadRows.filter((l) => String(l.rating ?? "").toLowerCase() === "hot");
  const totalLeads = leadRows.length;
  const hotLeadsCount = hotRows.length;

  const inactive7Days = leadRows.filter((l) => {
    if (!l.last_activity_at) return false;
    const ms = new Date(String(l.last_activity_at)).getTime();
    return ms <= Date.now() - 7 * 24 * 60 * 60 * 1000;
  }).length;

  const leadIds = leadRows
    .map((l) => {
      const raw = l.id;
      if (raw == null) return null;
      if (typeof raw === "number" && Number.isFinite(raw)) return raw;
      const s = String(raw).trim();
      if (/^\d+$/.test(s)) return Number(s);
      return s;
    })
    .filter((x): x is string | number => x != null);

  let leadsViewedReportsToday = 0;
  if (leadIds.length) {
    const { data: reportEvents } = await supabaseServer
      .from("lead_events")
      .select("lead_id")
      .eq("event_type", "report_view")
      .gte("created_at", todayIso)
      .in("lead_id", leadIds);
    leadsViewedReportsToday = new Set(((reportEvents as { lead_id?: unknown }[]) ?? []).map((e) => Number(e.lead_id)))
      .size;
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

  const insights = (briefing as { insights?: { suggestedActions?: string[]; topHotLeads?: { name?: string }[] } } | null)
    ?.insights;
  const aiAlerts = ((insights?.suggestedActions ?? []) as string[]).slice(0, 4);

  const taskRowsForUi: { id: string; title: string; done: boolean }[] = [];
  try {
    const { data: todayTasks } = await supabaseServer
      .from("tasks")
      .select("id,title,status,due_date")
      .eq("agent_id", ctx.agentId)
      .eq("status", "pending")
      .order("due_date", { ascending: true })
      .limit(6);
    for (const t of (todayTasks as { id?: unknown; title?: string; status?: string }[]) ?? []) {
      const id = String(t.id ?? "");
      if (!id) continue;
      taskRowsForUi.push({
        id,
        title: String(t.title ?? "Task"),
        done: String(t.status ?? "").toLowerCase() === "done",
      });
    }
  } catch {
    // tasks table optional
  }

  let conversationRows: { id: string; title: string; subtitle: string; at: string; href: string }[] = [];
  try {
    const { data: comms } = await supabaseServer
      .from("communications")
      .select("id,created_at,type,content,lead_id")
      .eq("agent_id", ctx.agentId)
      .order("created_at", { ascending: false })
      .limit(6);
    conversationRows = ((comms as { id?: unknown; created_at?: string; type?: string; content?: string; lead_id?: unknown }[]) ?? []).map(
      (c) => {
        const id = String(c.id ?? "");
        const body = String(c.content ?? "").trim();
        const preview = body.length > 72 ? `${body.slice(0, 70)}…` : body || "Message";
        const leadId = c.lead_id != null ? String(c.lead_id) : "";
        return {
          id,
          title: String(c.type ?? "message").toUpperCase(),
          subtitle: preview,
          at: c.created_at ? new Date(c.created_at).toLocaleString() : "—",
          href: leadId ? `/dashboard/leads?highlight=${encodeURIComponent(leadId)}` : "/dashboard/inbox",
        };
      }
    );
  } catch {
    conversationRows = [];
  }

  const hotSlice = hotRows.slice(0, 6);
  const hotLeadIds = hotSlice
    .map((l) => l.id)
    .filter((id): id is string | number => id != null && String(id) !== "");

  let latestMsgByLeadId = new Map<string, string>();
  if (hotLeadIds.length) {
    const { data: hotComms } = await supabaseServer
      .from("communications")
      .select("lead_id,content,created_at")
      .eq("agent_id", ctx.agentId)
      .in("lead_id", hotLeadIds)
      .order("created_at", { ascending: false });
    for (const row of (hotComms as { lead_id?: unknown; content?: string }[]) ?? []) {
      const lid = row.lead_id != null ? String(row.lead_id) : "";
      if (!lid || latestMsgByLeadId.has(lid)) continue;
      const raw = String(row.content ?? "").trim();
      if (raw) latestMsgByLeadId.set(lid, raw);
    }
  }

  const hotLeads = hotSlice.map((l) => {
    const idStr = String(l.id ?? "");
    const sub = hotLeadSubtitle(l as Record<string, unknown>, latestMsgByLeadId.get(idStr));
    return {
      id: idStr,
      name: String(l.name ?? "Lead"),
      href: `/dashboard/leads?id=${encodeURIComponent(idStr)}`,
      ...(sub ? { subtitle: sub } : {}),
    };
  });

  const stats = [
    {
      label: "Total leads",
      value: totalLeads,
      href: "/dashboard/leads",
      hint: "Active in CRM",
    },
    {
      label: "Hot leads",
      value: hotLeadsCount,
      href: "/dashboard/leads?filter=hot",
      hint: "Needs attention",
    },
    {
      label: "Messages sent",
      value: messagesSent,
      href: "/dashboard/send",
      hint: "All channels",
    },
    {
      label: "Quiet leads",
      value: inactive7Days,
      href: "/dashboard/leads?filter=inactive",
      hint: "7+ days inactive",
    },
  ];

  return (
    <div className="space-y-8">
      <AgentHomeDashboard
        greetingName={greetingName}
        stats={stats}
        agenda={[]}
        tasksToday={taskRowsForUi.map((t) => ({
          ...t,
          href: "/dashboard/tasks",
        }))}
        hotLeads={hotLeads}
        aiAlerts={aiAlerts.length ? aiAlerts : []}
        conversations={conversationRows}
      />

      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.03]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Today&apos;s AI briefing</h2>
            <p className="mt-1 text-xs text-slate-600">
              Deeper summary, lead picks, and generated tasks — same engine as before.
            </p>
          </div>
          <SendDailyBriefingButton />
        </div>
        {briefing ? (
          <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
            <p className="text-sm text-slate-700 whitespace-pre-line">{String((briefing as { summary?: string }).summary ?? "")}</p>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tasks from briefing</div>
              <div className="mt-2">
                <TasksFromBriefing />
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600">No briefing for today yet — generate one to populate insights.</p>
        )}
      </section>

      {await (async () => {
        const digest = await getLatestDigest(ctx.agentId).catch(() => null);
        if (!digest) return null;
        const m = digest.metrics;
        const ins = digest.insights;
        return (
          <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.03]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">{digest.title}</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Week of {new Date(digest.week_start).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  {" \u2013 "}
                  {new Date(digest.week_end).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {[
                { label: "Contacted", value: m.leads_contacted },
                { label: "SMS sent", value: m.sms_sent },
                { label: "Emails", value: m.emails_sent },
                { label: "Calls", value: m.calls_logged },
                { label: "Tasks done", value: m.tasks_completed },
                { label: "Meetings", value: m.appointments_booked },
              ].map((s) => (
                <div key={s.label} className="rounded-xl bg-slate-50 px-3 py-2 text-center">
                  <div className="text-lg font-bold text-slate-900">{s.value}</div>
                  <div className="text-[11px] text-slate-500">{s.label}</div>
                </div>
              ))}
            </div>
            {ins.length > 0 && (
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                {ins.map((i) => (
                  <div
                    key={i.key}
                    className={`rounded-lg px-3 py-2 text-sm ${
                      i.tone === "warning"
                        ? "bg-amber-50 text-amber-800"
                        : i.tone === "positive"
                          ? "bg-green-50 text-green-800"
                          : "bg-slate-50 text-slate-700"
                    }`}
                  >
                    <span className="font-medium">{i.label}:</span> {i.message}
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })()}

      <p className="text-center text-xs text-slate-400">
        Plan <span className="font-semibold text-slate-600">{usage.planType.toUpperCase()}</span>
        {" · "}
        Leads this month:{" "}
        <span className="font-semibold text-slate-600">
          {usage.used}
          {Number.isFinite(usage.limit) ? ` / ${usage.limit}` : ""}
        </span>
        {" · "}
        Reports viewed today: <span className="font-semibold text-slate-600">{leadsViewedReportsToday}</span>
      </p>
    </div>
  );
}
