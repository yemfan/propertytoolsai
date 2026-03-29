import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { getLeadLimit } from "@/lib/planLimits";
import { throwIfSupabaseError } from "@/lib/supabaseThrow";
import { ERROR_DASHBOARD_NO_AGENT_ROW } from "@leadsmart/shared";
import type {
  ContactFrequency,
  ContactMethod,
  CrmContactRow,
  CrmLeadRow,
  CrmPropertyReportRow,
  LeadRating,
  LeadStatus,
} from "@leadsmart/shared";

export { ERROR_DASHBOARD_NO_AGENT_ROW };
export type { ContactFrequency, ContactMethod, LeadRating, LeadStatus };
/** Alias for {@link CrmLeadRow} from `@leadsmart/shared` (dashboard Supabase row). */
export type LeadRow = CrmLeadRow;
/** Alias for {@link CrmContactRow} from `@leadsmart/shared`. */
export type ContactRow = CrmContactRow;
/** Alias for {@link CrmPropertyReportRow} from `@leadsmart/shared`. */
export type PropertyReportRow = CrmPropertyReportRow;

function addInterval(baseIso: string, freq: ContactFrequency) {
  const d = new Date(baseIso);
  if (freq === "daily") d.setUTCDate(d.getUTCDate() + 1);
  else if (freq === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString();
}

type AgentRow = {
  id: string;
  user_id: string;
  plan_type: "free" | "pro" | "elite" | string;
};

export async function getCurrentAgentContext(): Promise<{
  userId: string;
  agentId: string;
  planType: AgentRow["plan_type"];
  email: string | null;
}> {
  const supabase = supabaseServerClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) {
    const m = typeof userErr.message === "string" ? userErr.message.trim() : "";
    throw new Error(m || "Unable to verify your session");
  }
  const user = userData.user;
  if (!user) throw new Error("Not authenticated");

  // Prefer agents.auth_user_id mapping (Supabase Auth UUID).
  const { data: agent, error: agentErr } = await supabase
    .from("agents")
    .select("id,auth_user_id,plan_type")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (agentErr && (agentErr as any).code !== "PGRST116") {
    const m = typeof (agentErr as any).message === "string" ? String((agentErr as any).message).trim() : "";
    const code = (agentErr as any).code;
    throw new Error(m || (code ? `Agent lookup failed (${code})` : "Agent lookup failed"));
  }

  const agentIdRaw = (agent as any)?.id;
  if (agentIdRaw == null || agentIdRaw === "") {
    throw new Error(ERROR_DASHBOARD_NO_AGENT_ROW);
  }

  return {
    userId: user.id,
    agentId: String(agentIdRaw),
    planType: ((agent as any)?.plan_type ?? "free") as AgentRow["plan_type"],
    email: user.email ?? null,
  };
}

function applyFreePlanLimit<T>(rows: T[], planType: string, limit = 20) {
  if (planType === "free") return rows.slice(0, limit);
  return rows;
}

export async function getLeadUsageThisMonth(): Promise<{
  used: number;
  limit: number;
  planType: string;
}> {
  const { agentId, planType } = await getCurrentAgentContext();
  const supabase = supabaseServerClient();

  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));

  const { count, error } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agentId)
    .gte("created_at", start.toISOString());

  throwIfSupabaseError(error, "Could not load lead usage");

  const limit = getLeadLimit(planType);
  return { used: count ?? 0, limit, planType };
}

export async function getLeads(params?: {
  lead_status?: LeadStatus;
  source?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<CrmLeadRow[]> {
  const { agentId, planType } = await getCurrentAgentContext();
  const supabase = supabaseServerClient();

  let q = supabase
    .from("leads")
    .select(
      "id,agent_id,name,email,phone,property_address,source,lead_status,notes,engagement_score,last_activity_at,nurture_score,rating,contact_frequency,contact_method,last_contacted_at,next_contact_at,search_location,search_radius,price_min,price_max,beds,baths,created_at,prediction_score,prediction_label,prediction_factors,prediction_computed_at"
    )
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });

  if (params?.lead_status) q = q.eq("lead_status", params.lead_status);
  if (params?.source) q = q.eq("source", params.source);
  if (params?.search?.trim()) {
    const s = params.search.trim();
    q = q.or(`name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%`);
  }

  if (typeof params?.offset === "number" && typeof params?.limit === "number") {
    q = q.range(params.offset, params.offset + params.limit - 1);
  } else {
    q = q.limit(params?.limit ?? 100);
  }

  const { data, error } = await q;
  throwIfSupabaseError(error, "Could not load leads");
  const leads = (data as CrmLeadRow[]) ?? [];
  const leadIds = leads.map((l) => l.id).filter(Boolean);
  let scoreMap: Record<string, any> = {};
  if (leadIds.length) {
    const { data: scoreRows } = await supabase
      .from("lead_scores")
      .select("lead_id,score,intent,timeline,confidence,explanation,updated_at")
      .in("lead_id", leadIds as any)
      .order("updated_at", { ascending: false })
      .limit(5000);
    for (const row of scoreRows ?? []) {
      const key = String((row as any).lead_id ?? "");
      if (!key || scoreMap[key]) continue;
      scoreMap[key] = row;
    }
  }

  const hydrated = leads.map((l) => {
    const s = scoreMap[String(l.id)] as any;
    return {
      ...l,
      ai_lead_score: s ? Number(s.score ?? 0) : null,
      ai_intent: s?.intent ?? null,
      ai_timeline: s?.timeline ?? null,
      ai_confidence: s ? Number(s.confidence ?? 0) : null,
      ai_explanation: Array.isArray(s?.explanation) ? s.explanation : [],
    } as CrmLeadRow;
  });

  return applyFreePlanLimit(hydrated, planType);
}

export async function getContacts(limit = 200): Promise<CrmContactRow[]> {
  const { agentId } = await getCurrentAgentContext();
  const supabase = supabaseServerClient();

  const { data, error } = await supabase
    .from("contacts")
    .select("id,agent_id,name,email,phone,address,type,created_at")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(limit);

  throwIfSupabaseError(error, "Could not load contacts");
  return (data as CrmContactRow[]) ?? [];
}

export async function getReports(limit = 200): Promise<CrmPropertyReportRow[]> {
  const { agentId } = await getCurrentAgentContext();
  const supabase = supabaseServerClient();

  const { data, error } = await supabase
    .from("property_reports")
    .select("id,agent_id,address,report_type,created_at")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(limit);

  throwIfSupabaseError(error, "Could not load reports");
  return (data as CrmPropertyReportRow[]) ?? [];
}

export async function updateLeadStatus(id: string, status: LeadStatus) {
  const { agentId } = await getCurrentAgentContext();
  const supabase = supabaseServerClient();

  const { error } = await supabase
    .from("leads")
    .update({ lead_status: status })
    .eq("id", id)
    .eq("agent_id", agentId);

  throwIfSupabaseError(error, "Could not update lead status");
}

export async function updateLeadNotes(id: string, notes: string) {
  const { agentId } = await getCurrentAgentContext();
  const supabase = supabaseServerClient();

  const { error } = await supabase
    .from("leads")
    .update({ notes })
    .eq("id", id)
    .eq("agent_id", agentId);

  throwIfSupabaseError(error, "Could not update lead notes");
}

export async function updateLeadFollowUpSettings(
  id: string,
  next: {
    rating?: LeadRating;
    contact_frequency?: ContactFrequency;
    contact_method?: ContactMethod;
  }
) {
  const { agentId } = await getCurrentAgentContext();
  const supabase = supabaseServerClient();

  const updatePayload: any = {};
  if (next.rating) updatePayload.rating = next.rating;
  if (next.contact_frequency) updatePayload.contact_frequency = next.contact_frequency;
  if (next.contact_method) updatePayload.contact_method = next.contact_method;

  // Respect SMS consent: only send SMS when contact_method includes SMS.
  if (next.contact_method) {
    const m = next.contact_method;
    updatePayload.sms_opt_in = m === "sms" || m === "both";
  }

  if (next.contact_frequency) {
    updatePayload.next_contact_at = addInterval(new Date().toISOString(), next.contact_frequency);
  }

  const { error } = await supabase
    .from("leads")
    .update(updatePayload)
    .eq("id", id)
    .eq("agent_id", agentId);

  throwIfSupabaseError(error, "Could not update follow-up settings");
}

