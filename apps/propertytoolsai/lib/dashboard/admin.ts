import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  anyTimestampInRange,
  parseDateRangeQuery,
  timeMs,
} from "@/lib/dashboard/dateRange";
import {
  BILLING_SUBSCRIPTIONS_SELECT,
  BILLING_SUBSCRIPTIONS_TABLE,
  LEADS_SELECT_PLATFORM_OVERVIEW,
  leadEngagementScore,
  leadRowHasAssignedAgent,
  pageFromToolEventMetadata,
  subscriptionMonthlyRevenue,
} from "@/lib/dashboard/schemaConfig";

export type PlatformOverviewResponse = {
  kpis: {
    visitors: number;
    toolUsage: number;
    leadsCaptured: number;
    qualifiedLeads: number;
    payingAgents: number;
    revenue: number;
  };
  propertyTools: {
    traffic: number;
    conversionRate: number;
    premiumUpgrades: number;
    topTools: Array<{ name: string; users: number; conversion: number }>;
    topPages: Array<{ page: string; visitors: number }>;
  };
  leadSmart: {
    activeAgents: number;
    leadAssignments: number;
    followUpRate: number;
    closeRate: number;
    mrr: number;
  };
  funnel: Array<{ stage: string; value: number }>;
  support: {
    openTickets: number;
    urgentTickets: number;
    avgResponseMinutes: number;
    categories: Array<{ label: string; count: number }>;
  };
  alerts: Array<{ title: string; detail: string }>;
  trends: {
    visitorsByDay: Array<{ label: string; value: number }>;
    leadsByDay: Array<{ label: string; value: number }>;
    funnelBreakdown: Array<{ label: string; value: number }>;
    supportCategoryBreakdown: Array<{ label: string; value: number }>;
    revenueByPlan: Array<{ label: string; value: number }>;
  };
};

/** @deprecated Use {@link PlatformOverviewResponse} */
export type AdminPlatformOverview = PlatformOverviewResponse;

type ToolEventRow = {
  session_id?: string | null;
  tool_name?: string | null;
  event_name?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
};

type LeadRow = Record<string, unknown>;

type BillingSubRow = Record<string, unknown>;

type SupportRow = {
  status?: string | null;
  priority?: string | null;
  subject?: string | null;
  updated_at?: string | null;
};

function leadStatus(l: LeadRow): string {
  return String(l.lead_status ?? l.status ?? "").toLowerCase();
}

function hasFollowUpSignal(l: LeadRow): boolean {
  if (l.last_contacted_at) return true;
  if (l.next_contact_at) return true;
  return false;
}

function supportStatus(r: SupportRow): string {
  return String(r.status ?? "").toLowerCase();
}

function supportPriority(r: SupportRow): string {
  return String(r.priority ?? "").toLowerCase();
}

export function emptyPlatformOverviewResponse(): PlatformOverviewResponse {
  return {
    kpis: {
      visitors: 0,
      toolUsage: 0,
      leadsCaptured: 0,
      qualifiedLeads: 0,
      payingAgents: 0,
      revenue: 0,
    },
    propertyTools: {
      traffic: 0,
      conversionRate: 0,
      premiumUpgrades: 0,
      topTools: [],
      topPages: [],
    },
    leadSmart: {
      activeAgents: 0,
      leadAssignments: 0,
      followUpRate: 0,
      closeRate: 0,
      mrr: 0,
    },
    funnel: [],
    support: {
      openTickets: 0,
      urgentTickets: 0,
      avgResponseMinutes: 4,
      categories: [],
    },
    alerts: [],
    trends: {
      visitorsByDay: [],
      leadsByDay: [],
      funnelBreakdown: [],
      supportCategoryBreakdown: [],
      revenueByPlan: [],
    },
  };
}

/**
 * Cross-product admin snapshot. Uses `tool_events`, `leads`, `billing_subscriptions`, `support_conversations`.
 * `subscriptions` in older docs maps to **`billing_subscriptions`** in this codebase.
 */
export async function getPlatformOverview({
  start,
  end,
}: { start?: string; end?: string } = {}): Promise<PlatformOverviewResponse> {
  const [toolRes, leadsRes, billingRes, supportRes] = await Promise.all([
    supabaseAdmin
      .from("tool_events")
      .select("session_id, tool_name, event_name, metadata, created_at")
      .limit(100_000),
    supabaseAdmin.from("leads").select(LEADS_SELECT_PLATFORM_OVERVIEW).limit(100_000),
    supabaseAdmin.from(BILLING_SUBSCRIPTIONS_TABLE).select(BILLING_SUBSCRIPTIONS_SELECT).limit(50_000),
    supabaseAdmin.from("support_conversations").select("status, priority, subject, updated_at").limit(50_000),
  ]);

  if (toolRes.error) console.warn("[getPlatformOverview] tool_events", toolRes.error.message);
  if (leadsRes.error) console.warn("[getPlatformOverview] leads", leadsRes.error.message);
  if (billingRes.error) console.warn("[getPlatformOverview] billing_subscriptions", billingRes.error.message);
  if (supportRes.error) console.warn("[getPlatformOverview] support_conversations", supportRes.error.message);

  const range = parseDateRangeQuery(start, end);

  let events = (toolRes.data ?? []) as ToolEventRow[];
  if (range) {
    events = events.filter((e) => {
      const t = timeMs(e.created_at);
      return t != null && t >= range.startMs && t <= range.endMs;
    });
  }

  let leadRows = (leadsRes.data ?? []) as LeadRow[];
  if (range) {
    leadRows = leadRows.filter((l) =>
      anyTimestampInRange(
        [
          l.created_at as string | undefined,
          l.updated_at as string | undefined,
          l.last_contacted_at as string | undefined,
          l.next_contact_at as string | undefined,
        ],
        range
      )
    );
  }

  let subscriptionRows = (billingRes.data ?? []) as BillingSubRow[];
  if (range) {
    subscriptionRows = subscriptionRows.filter((s) =>
      anyTimestampInRange([s.created_at as string | undefined, s.updated_at as string | undefined], range)
    );
  }

  let supportRows = (supportRes.data ?? []) as SupportRow[];
  if (range) {
    supportRows = supportRows.filter((r) => anyTimestampInRange([r.updated_at], range));
  }

  const visitorSessions = new Set(events.filter((e) => e.session_id).map((e) => String(e.session_id)));
  const visitors = visitorSessions.size;

  const toolUsage = events.filter((e) =>
    ["tool_started", "estimate_generated", "tool_click"].includes(String(e.event_name ?? ""))
  ).length;

  const leadsCaptured = leadRows.length;
  const qualifiedLeads = leadRows.filter(
    (l) =>
      leadEngagementScore(l) >= 60 || ["qualified", "closed"].includes(leadStatus(l))
  ).length;

  const payingSubs = subscriptionRows.filter((s) => String(s.status ?? "").toLowerCase() === "active");
  const payingAgents = payingSubs.length;
  const revenue = payingSubs.reduce((sum, s) => sum + subscriptionMonthlyRevenue(s), 0);

  const propertyToolMap = new Map<string, number>();
  for (const e of events) {
    const tn = e.tool_name;
    if (tn) {
      propertyToolMap.set(String(tn), (propertyToolMap.get(String(tn)) || 0) + 1);
    }
  }

  const topTools = Array.from(propertyToolMap.entries())
    .map(([name, users]) => ({
      name,
      users,
      conversion: leadsCaptured > 0 ? Number(((users / Math.max(visitors, 1)) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.users - a.users)
    .slice(0, 5);

  const pageMap = new Map<string, number>();
  for (const e of events) {
    const page = pageFromToolEventMetadata(e.metadata ?? null);
    if (page) {
      pageMap.set(page, (pageMap.get(page) || 0) + 1);
    }
  }

  const topPages = Array.from(pageMap.entries())
    .map(([page, v]) => ({ page, visitors: v }))
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 5);

  const premiumUpgrades = subscriptionRows.filter((s) =>
    String(s.plan ?? "")
      .toLowerCase()
      .includes("premium")
  ).length;

  const assignedLeads = leadRows.filter((l) => leadRowHasAssignedAgent(l)).length;
  const followUpRate =
    leadRows.length > 0
      ? Number(((leadRows.filter((l) => hasFollowUpSignal(l)).length / leadRows.length) * 100).toFixed(1))
      : 0;

  const closeRate =
    leadRows.length > 0
      ? Number(((leadRows.filter((l) => leadStatus(l) === "closed").length / leadRows.length) * 100).toFixed(1))
      : 0;

  const openTickets = supportRows.filter((r) => !["resolved", "closed"].includes(supportStatus(r))).length;
  const urgentTickets = supportRows.filter((r) => supportPriority(r) === "urgent").length;
  const avgResponseMinutes = 4;

  const supportCategoryMap = new Map<string, number>();
  for (const row of supportRows) {
    const subject = (row.subject || "").toLowerCase();
    let category = "General";
    if (subject.includes("billing")) category = "Billing";
    else if (subject.includes("login")) category = "Login / Access";
    else if (subject.includes("home value")) category = "Home Value Tool";
    supportCategoryMap.set(category, (supportCategoryMap.get(category) || 0) + 1);
  }

  const categories = Array.from(supportCategoryMap.entries()).map(([label, count]) => ({
    label,
    count,
  }));

  const traffic = visitors;
  const conversionRate = visitors > 0 ? Number(((leadsCaptured / visitors) * 100).toFixed(1)) : 0;

  const alerts: Array<{ title: string; detail: string }> = [];
  if (urgentTickets > 0) {
    alerts.push({
      title: `${urgentTickets} urgent support tickets`,
      detail: "Support workload needs review",
    });
  }
  if (closeRate < 10) {
    alerts.push({
      title: "Close rate is below target",
      detail: `Current close rate is ${closeRate}%`,
    });
  }
  if (premiumUpgrades > 0) {
    alerts.push({
      title: "Premium upgrades active",
      detail: `${premiumUpgrades} premium subscriptions recorded`,
    });
  }

  const funnel = [
    { stage: "Visitors", value: visitors },
    { stage: "Tool Users", value: toolUsage },
    { stage: "Leads", value: leadsCaptured },
    { stage: "Qualified Leads", value: qualifiedLeads },
    { stage: "Assigned Leads", value: assignedLeads },
    { stage: "Closed Deals", value: leadRows.filter((l) => leadStatus(l) === "closed").length },
  ];

  const visitorsByDayMap = new Map<string, Set<string>>();
  for (const e of events) {
    const sid = e.session_id;
    const iso = e.created_at;
    if (!sid || typeof iso !== "string" || iso.length < 10) continue;
    const dayKey = iso.slice(0, 10);
    if (!visitorsByDayMap.has(dayKey)) visitorsByDayMap.set(dayKey, new Set());
    visitorsByDayMap.get(dayKey)!.add(String(sid));
  }
  const visitorsByDay = Array.from(visitorsByDayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dayKey, set]) => ({
      label: dayKey.slice(5),
      value: set.size,
    }));

  const leadsByDayMap = new Map<string, number>();
  for (const l of leadRows) {
    const iso = l.created_at;
    if (typeof iso !== "string" || iso.length < 10) continue;
    const dayKey = iso.slice(0, 10);
    leadsByDayMap.set(dayKey, (leadsByDayMap.get(dayKey) || 0) + 1);
  }
  const leadsByDay = Array.from(leadsByDayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dayKey, value]) => ({
      label: dayKey.slice(5),
      value,
    }));

  const funnelBreakdown = funnel.map((f) => ({
    label: f.stage,
    value: f.value,
  }));

  const supportCategoryBreakdown = categories.map((c) => ({
    label: c.label,
    value: c.count,
  }));

  const revenueByPlanMap = new Map<string, number>();
  for (const s of payingSubs) {
    const plan = String(s.plan ?? "Other").trim() || "Other";
    revenueByPlanMap.set(plan, (revenueByPlanMap.get(plan) || 0) + subscriptionMonthlyRevenue(s));
  }
  const revenueByPlan = Array.from(revenueByPlanMap.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  return {
    kpis: {
      visitors,
      toolUsage,
      leadsCaptured,
      qualifiedLeads,
      payingAgents,
      revenue,
    },
    propertyTools: {
      traffic,
      conversionRate,
      premiumUpgrades,
      topTools,
      topPages,
    },
    leadSmart: {
      activeAgents: payingAgents,
      leadAssignments: assignedLeads,
      followUpRate,
      closeRate,
      mrr: revenue,
    },
    funnel,
    support: {
      openTickets,
      urgentTickets,
      avgResponseMinutes,
      categories,
    },
    alerts,
    trends: {
      visitorsByDay,
      leadsByDay,
      funnelBreakdown,
      supportCategoryBreakdown,
      revenueByPlan,
    },
  };
}

/** @deprecated Use {@link getPlatformOverview} */
export async function getAdminPlatformOverview(
  opts?: { start?: string; end?: string }
): Promise<PlatformOverviewResponse> {
  return getPlatformOverview(opts);
}
