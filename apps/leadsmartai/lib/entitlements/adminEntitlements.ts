import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AgentEntitlement } from "@/lib/entitlements/types";

/**
 * Service-role queries (bypass RLS). Use only in server Route Handlers, Server Actions,
 * cron, or internal admin tools — never from client components.
 */

export async function getUserEntitlements(userId: string): Promise<AgentEntitlement[]> {
  const { data, error } = await supabaseAdmin
    .from("product_entitlements")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) throw error;
  return (data ?? []) as AgentEntitlement[];
}

/**
 * Active LeadSmart AI Agent row from `active_product_entitlements` (is_active + date window).
 * View omits `source`; cast is still valid for `AgentEntitlement` with optional `source`.
 */
export async function getAgentEntitlement(userId: string): Promise<AgentEntitlement | null> {
  const { data, error } = await supabaseAdmin
    .from("active_product_entitlements")
    .select("*")
    .eq("user_id", userId)
    .eq("product", "leadsmart_agent")
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as AgentEntitlement | null;
}
