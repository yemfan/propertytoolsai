import type { SupabaseClient } from "@supabase/supabase-js";
import { PRODUCT_LEADSMART_AGENT } from "./product";
import { getActiveAgentEntitlement } from "./getEntitlements";
import type { AgentUsageDaily } from "./types";

export function utcTodayDateString(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function getTodayUsage(
  supabase: SupabaseClient,
  userId: string,
  product: string = PRODUCT_LEADSMART_AGENT
): Promise<AgentUsageDaily | null> {
  const usageDate = utcTodayDateString();
  const { data, error } = await supabase
    .from("entitlement_usage_daily")
    .select("*")
    .eq("user_id", userId)
    .eq("product", product)
    .eq("usage_date", usageDate)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as AgentUsageDaily | null) ?? null;
}

export async function getAgentNumericId(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("agents")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (error && (error as { code?: string }).code !== "PGRST116") {
    throw new Error(error.message);
  }
  const id = (data as { id?: unknown } | null)?.id;
  return id != null && id !== "" ? String(id) : null;
}

export async function countLeadsForAgent(supabase: SupabaseClient, agentId: string): Promise<number> {
  const { count, error } = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agentId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function countContactsForAgent(supabase: SupabaseClient, agentId: string): Promise<number> {
  const { count, error } = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agentId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function buildEntitlementSnapshot(supabase: SupabaseClient, userId: string) {
  const ent = await getActiveAgentEntitlement(supabase, userId);
  const usage = await getTodayUsage(supabase, userId);
  const agentId = await getAgentNumericId(supabase, userId);
  const leads = agentId ? await countLeadsForAgent(supabase, agentId) : 0;
  const contacts = agentId ? await countContactsForAgent(supabase, agentId) : 0;

  return {
    entitlement: ent,
    usageToday: usage,
    counts: { leads, contacts },
  };
}

/** Server-only: bumps daily counters via service role (call after limit checks). */
export { incrementUsage, type UsageCounterField } from "./adminUsage";
