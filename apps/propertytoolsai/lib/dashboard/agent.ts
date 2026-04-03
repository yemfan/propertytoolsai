import { isNumericCrmAgentId } from "@/lib/dashboardService";
import {
  LEADS_AGENT_OWNER_COLUMN,
  LEADS_SELECT_AGENT_DASHBOARD,
  leadEngagementScore,
} from "@/lib/dashboard/schemaConfig";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { scoreLeadAttention, type NotificationDeliveryTiming, type NotificationPriority } from "@leadsmart/shared";

/** Row shape from `public.leads` — tolerate legacy/extra columns. */
export type LeadRowLike = {
  id: string | number;
  name?: string | null;
  lead_status?: string | null;
  status?: string | null;
  engagement_score?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  next_contact_at?: string | null;
  next_follow_up_at?: string | null;
  search_location?: string | null;
  property_address?: string | null;
};

export type AgentDashboardResponse = {
  kpis: {
    newLeads: number;
    hotLeads: number;
    followUpsDue: number;
    activeDeals: number;
    closedThisMonth: number;
  };
  hotLeads: Array<{
    id: string;
    name: string;
    city: string;
    score: number;
    status: string;
    attentionScore?: number;
    attentionPriority?: NotificationPriority;
    attentionReasons?: string[];
    deliveryTiming?: NotificationDeliveryTiming;
  }>;
  pipeline: Array<{
    stage: string;
    count: number;
  }>;
  alerts: string[];
  recentActivity: string[];
  trends: {
    leadsByDay: Array<{ label: string; value: number }>;
    pipelineBreakdown: Array<{ label: string; value: number }>;
  };
};

export function emptyAgentDashboardResponse(): AgentDashboardResponse {
  return {
    kpis: {
      newLeads: 0,
      hotLeads: 0,
      followUpsDue: 0,
      activeDeals: 0,
      closedThisMonth: 0,
    },
    hotLeads: [],
    pipeline: [
      { stage: "New", count: 0 },
      { stage: "Contacted", count: 0 },
      { stage: "Qualified", count: 0 },
      { stage: "Offer", count: 0 },
      { stage: "Under Contract", count: 0 },
      { stage: "Closed", count: 0 },
    ],
    alerts: [],
    recentActivity: [],
    trends: {
      leadsByDay: [],
      pipelineBreakdown: [],
    },
  };
}

function startOfMonthIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

function statusOf(l: LeadRowLike): string {
  const raw = l.lead_status ?? l.status;
  return String(raw ?? "new").toLowerCase();
}

function nextFollowUpIso(l: LeadRowLike): string | null {
  const n = l.next_follow_up_at ?? l.next_contact_at;
  if (n == null || typeof n !== "string") return null;
  return n;
}

function cityFromLead(l: LeadRowLike): string {
  const loc = l.search_location;
  if (typeof loc === "string" && loc.trim()) {
    return loc.split(",")[0]?.trim() || "Unknown";
  }
  const addr = l.property_address;
  if (typeof addr === "string" && addr.trim()) {
    return addr.split(",")[0]?.trim() || "Unknown";
  }
  return "Unknown";
}

function hasCreatedAtFilter(start?: string, end?: string): boolean {
  return Boolean(start?.trim() || end?.trim());
}

/**
 * Resolve numeric CRM `agents.id` for Supabase Auth `userId` (UUID).
 */
export async function resolveCrmAgentIdForUser(userId: string): Promise<string | null> {
  const { data: agent, error } = await supabaseAdmin
    .from("agents")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (error && (error as { code?: string }).code !== "PGRST116") {
    console.warn("[resolveCrmAgentIdForUser]", error.message);
  }

  const rawId = agent?.id != null ? String(agent.id) : "";
  return isNumericCrmAgentId(rawId) ? rawId : null;
}

/**
 * CRM dashboard for one agent. Uses {@link LEADS_AGENT_OWNER_COLUMN} on `public.leads`.
 * Optional `start` / `end` (`YYYY-MM-DD`) filter rows by `created_at` at the database.
 */
export async function getAgentDashboardOverview({
  agentId,
  start,
  end,
}: {
  agentId: string;
  start?: string;
  end?: string;
}): Promise<AgentDashboardResponse> {
  let query = supabaseAdmin
    .from("leads")
    .select(LEADS_SELECT_AGENT_DASHBOARD)
    .eq(LEADS_AGENT_OWNER_COLUMN, agentId);

  const s = start?.trim();
  const e = end?.trim();
  if (s) query = query.gte("created_at", `${s}T00:00:00.000Z`);
  if (e) query = query.lte("created_at", `${e}T23:59:59.999Z`);

  const { data: leads, error } = await query;
  if (error) throw error;

  const rows = (leads ?? []) as LeadRowLike[];
  const monthStart = startOfMonthIso();
  const dateFiltered = hasCreatedAtFilter(start, end);

  const scoreOf = (l: LeadRowLike) => leadEngagementScore(l as Record<string, unknown>);

  const newLeads = rows.filter((l) => statusOf(l) === "new").length;
  const hotLeads = rows.filter((l) => scoreOf(l) >= 60).length;
  const activeDeals = rows.filter((l) =>
    ["qualified", "offer", "under_contract", "active_deal"].includes(statusOf(l))
  ).length;

  const closedThisMonth = rows.filter((l) => {
    if (statusOf(l) !== "closed") return false;
    if (dateFiltered) return true;
    return Boolean(l.updated_at && l.updated_at >= monthStart);
  }).length;

  const followUpsDue = rows.filter((l) => {
    const iso = nextFollowUpIso(l);
    if (!iso) return false;
    return new Date(iso) <= new Date();
  }).length;

  const topHotLeads = rows
    .filter((l) => scoreOf(l) >= 60)
    .sort((a, b) => scoreOf(b) - scoreOf(a))
    .slice(0, 5)
    .map((l) => {
      const engagement = scoreOf(l);
      const att = scoreLeadAttention({
        hotLead: engagement >= 60,
        dealPredictionScore: engagement,
      });
      return {
        id: String(l.id),
        name: l.name || "Unknown Lead",
        city: cityFromLead(l),
        score: engagement,
        status: statusOf(l) || "new",
        attentionScore: att.score,
        attentionPriority: att.priority,
        attentionReasons: att.reasons.slice(0, 3),
        deliveryTiming: att.deliveryTiming,
      };
    });

  const pipeline = [
    { stage: "New", count: rows.filter((l) => statusOf(l) === "new").length },
    { stage: "Contacted", count: rows.filter((l) => statusOf(l) === "contacted").length },
    { stage: "Qualified", count: rows.filter((l) => statusOf(l) === "qualified").length },
    { stage: "Offer", count: rows.filter((l) => statusOf(l) === "offer").length },
    { stage: "Under Contract", count: rows.filter((l) => statusOf(l) === "under_contract").length },
    { stage: "Closed", count: rows.filter((l) => statusOf(l) === "closed").length },
  ];

  const leadsByDayMap = new Map<string, number>();
  for (const row of rows) {
    const iso = row.created_at;
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

  const pipelineBreakdown = pipeline.map((p) => ({
    label: p.stage,
    value: p.count,
  }));

  const alerts: string[] = [];
  if (hotLeads > 0) alerts.push(`${hotLeads} hot leads need attention`);
  if (followUpsDue > 0) alerts.push(`${followUpsDue} follow-ups are due now`);
  if (closedThisMonth > 0) {
    alerts.push(
      dateFiltered
        ? `${closedThisMonth} deals closed in selected period`
        : `${closedThisMonth} deals closed this month`
    );
  }

  const recentActivity = rows
    .filter((l) => l.updated_at)
    .sort(
      (a, b) =>
        new Date(String(b.updated_at)).getTime() - new Date(String(a.updated_at)).getTime()
    )
    .slice(0, 5)
    .map((l) => {
      const leadName = l.name || "Lead";
      return `${leadName} updated: ${statusOf(l) || "activity recorded"}`;
    });

  return {
    kpis: {
      newLeads,
      hotLeads,
      followUpsDue,
      activeDeals,
      closedThisMonth,
    },
    hotLeads: topHotLeads,
    pipeline,
    alerts,
    recentActivity,
    trends: {
      leadsByDay,
      pipelineBreakdown,
    },
  };
}
