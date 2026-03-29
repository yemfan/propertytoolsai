import { supabaseAdmin } from "@/lib/supabase/admin";

const SUPPORT_CONVERSATIONS_SELECT =
  "public_id,customer_name,subject,status,priority,unread_for_support,updated_at,last_message_at,assigned_agent_name,created_at";

/** When `created_at` is not on the table yet (legacy DB). */
const SUPPORT_CONVERSATIONS_SELECT_WITHOUT_CREATED_AT =
  "public_id,customer_name,subject,status,priority,unread_for_support,updated_at,last_message_at,assigned_agent_name";

function isMissingCreatedAtError(error: { message?: string; code?: string }): boolean {
  const msg = (error.message ?? "").toLowerCase();
  const code = String(error.code ?? "");
  if (!msg.includes("created_at")) return false;
  if (msg.includes("does not exist") || msg.includes("undefined column")) return true;
  if (code === "42703") return true;
  return false;
}

/** Date filter using best available timestamps when `created_at` is absent. */
function rowMatchesDateBounds(
  row: SupportConversationRow,
  start?: string,
  end?: string
): boolean {
  const s = start?.trim();
  const e = end?.trim();
  if (!s && !e) return true;

  const ts = row.created_at ?? row.last_message_at ?? row.updated_at;
  if (typeof ts !== "string" || ts.length < 10) return false;

  const t = new Date(ts).getTime();
  if (!Number.isFinite(t)) return false;

  if (s) {
    const startMs = Date.parse(`${s}T00:00:00.000Z`);
    if (Number.isFinite(startMs) && t < startMs) return false;
  }
  if (e) {
    const endMs = Date.parse(`${e}T23:59:59.999Z`);
    if (Number.isFinite(endMs) && t > endMs) return false;
  }
  return true;
}

export type SupportDashboardResponse = {
  kpis: {
    openTickets: number;
    urgentTickets: number;
    waitingOnSupport: number;
    avgResponseMinutes: number;
    resolvedToday: number;
  };
  ticketQueue: Array<{
    publicId: string;
    customerName: string;
    subject: string;
    priority: string;
    unreadForSupport: number;
    status: string;
  }>;
  issueTrends: Array<{
    label: string;
    count: number;
  }>;
  teamWorkload: Array<{
    agentName: string;
    activeTickets: number;
  }>;
  trends: {
    ticketsByDay: Array<{ label: string; value: number }>;
    issueCategoryBreakdown: Array<{ label: string; value: number }>;
  };
};

/** Row shape for `support_conversations` (aligns with support-chat service). */
export type SupportConversationRow = {
  public_id?: string | null;
  customer_name?: string | null;
  subject?: string | null;
  status?: string | null;
  priority?: string | null;
  unread_for_support?: number | null;
  updated_at?: string | null;
  last_message_at?: string | null;
  assigned_agent_name?: string | null;
  created_at?: string | null;
};

export function emptySupportDashboardResponse(): SupportDashboardResponse {
  return {
    kpis: {
      openTickets: 0,
      urgentTickets: 0,
      waitingOnSupport: 0,
      avgResponseMinutes: 4,
      resolvedToday: 0,
    },
    ticketQueue: [],
    issueTrends: [],
    teamWorkload: [],
    trends: {
      ticketsByDay: [],
      issueCategoryBreakdown: [],
    },
  };
}

function todayStartIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

function hasCreatedAtFilter(start?: string, end?: string): boolean {
  return Boolean(start?.trim() || end?.trim());
}

function statusOf(r: SupportConversationRow): string {
  return String(r.status ?? "").toLowerCase();
}

function priorityOf(r: SupportConversationRow): string {
  return String(r.priority ?? "").toLowerCase();
}

function issueCategoryFromSubject(subject: string): string {
  const s = subject.toLowerCase();
  if (s.includes("billing")) return "Billing";
  if (s.includes("login") || s.includes("access")) return "Login / Access";
  if (s.includes("home value")) return "Home Value Tool";
  if (s.includes("lead")) return "Lead Flow";
  return "General";
}

function buildIssueCategoryMap(rows: SupportConversationRow[]): Map<string, number> {
  const issueCategoryMap = new Map<string, number>();
  for (const row of rows) {
    const category = issueCategoryFromSubject(row.subject || "");
    issueCategoryMap.set(category, (issueCategoryMap.get(category) || 0) + 1);
  }
  return issueCategoryMap;
}

/**
 * Support inbox + workload from `support_conversations`.
 * Optional `start` / `end` (`YYYY-MM-DD`) filter rows by `created_at` at the database.
 */
export async function getSupportDashboardOverview({
  start,
  end,
}: {
  start?: string;
  end?: string;
} = {}): Promise<SupportDashboardResponse> {
  const s = start?.trim();
  const e = end?.trim();

  let query = supabaseAdmin
    .from("support_conversations")
    .select(SUPPORT_CONVERSATIONS_SELECT)
    .order("last_message_at", { ascending: false });

  if (s) query = query.gte("created_at", `${s}T00:00:00.000Z`);
  if (e) query = query.lte("created_at", `${e}T23:59:59.999Z`);

  const { data: conversations, error } = await query;

  let rows: SupportConversationRow[];

  if (error && isMissingCreatedAtError(error)) {
    console.warn(
      "[getSupportDashboardOverview] support_conversations — no created_at, using legacy select + in-memory date filter",
      error.message
    );
    const legacyQuery = supabaseAdmin
      .from("support_conversations")
      .select(SUPPORT_CONVERSATIONS_SELECT_WITHOUT_CREATED_AT)
      .order("last_message_at", { ascending: false });
    const legacy = await legacyQuery;
    if (legacy.error) {
      console.warn("[getSupportDashboardOverview] support_conversations", legacy.error.message);
      return emptySupportDashboardResponse();
    }
    let legacyRows = (legacy.data ?? []) as SupportConversationRow[];
    if (s || e) {
      legacyRows = legacyRows.filter((r) => rowMatchesDateBounds(r, start, end));
    }
    rows = legacyRows;
  } else if (error) {
    console.warn("[getSupportDashboardOverview] support_conversations", error.message);
    return emptySupportDashboardResponse();
  } else {
    rows = (conversations ?? []) as SupportConversationRow[];
  }
  const todayStart = todayStartIso();
  const dateFiltered = hasCreatedAtFilter(start, end);

  const openTickets = rows.filter((r) => !["resolved", "closed"].includes(statusOf(r))).length;
  const urgentTickets = rows.filter((r) => priorityOf(r) === "urgent").length;
  const waitingOnSupport = rows.filter((r) => statusOf(r) === "waiting_on_support").length;
  const resolvedToday = rows.filter((r) => {
    if (statusOf(r) !== "resolved") return false;
    if (dateFiltered) return true;
    return Boolean(r.updated_at && String(r.updated_at) >= todayStart);
  }).length;

  const avgResponseMinutes = 4;

  const ticketQueue = rows.slice(0, 10).map((r) => ({
    publicId: String(r.public_id ?? ""),
    customerName: r.customer_name || "Unknown",
    subject: r.subject || "No subject",
    priority: r.priority || "normal",
    unreadForSupport: r.unread_for_support ?? 0,
    status: r.status || "open",
  }));

  const issueCategoryMap = buildIssueCategoryMap(rows);
  const issueTrends = Array.from(issueCategoryMap.entries()).map(([label, count]) => ({
    label,
    count,
  }));

  const issueCategoryBreakdown = issueTrends.map(({ label, count }) => ({
    label,
    value: count,
  }));

  const ticketsByDayMap = new Map<string, number>();
  for (const row of rows) {
    const iso = row.created_at ?? row.last_message_at;
    if (typeof iso !== "string" || iso.length < 10) continue;
    const dayKey = iso.slice(0, 10);
    ticketsByDayMap.set(dayKey, (ticketsByDayMap.get(dayKey) || 0) + 1);
  }
  const ticketsByDay = Array.from(ticketsByDayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dayKey, value]) => ({
      label: dayKey.slice(5),
      value,
    }));

  const workloadMap = new Map<string, number>();
  for (const row of rows) {
    if (!["resolved", "closed"].includes(statusOf(row))) {
      const agent = row.assigned_agent_name || "Unassigned";
      workloadMap.set(agent, (workloadMap.get(agent) || 0) + 1);
    }
  }

  const teamWorkload = Array.from(workloadMap.entries()).map(([agentName, activeTickets]) => ({
    agentName,
    activeTickets,
  }));

  return {
    kpis: {
      openTickets,
      urgentTickets,
      waitingOnSupport,
      avgResponseMinutes,
      resolvedToday,
    },
    ticketQueue,
    issueTrends,
    teamWorkload,
    trends: {
      ticketsByDay,
      issueCategoryBreakdown,
    },
  };
}
