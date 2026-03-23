import type { SupabaseClient } from "@supabase/supabase-js";
import { PRODUCT_LEADSMART_AGENT } from "./product";
import type { AgentEntitlement } from "./types";

export async function getUserEntitlements(
  supabase: SupabaseClient,
  userId: string
): Promise<AgentEntitlement[]> {
  const { data, error } = await supabase
    .from("product_entitlements")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data as AgentEntitlement[]) ?? [];
}

export async function getAgentEntitlement(
  supabase: SupabaseClient,
  userId: string
): Promise<AgentEntitlement | null> {
  return getActiveAgentEntitlement(supabase, userId);
}

export async function getActiveAgentEntitlement(
  supabase: SupabaseClient,
  userId: string
): Promise<AgentEntitlement | null> {
  const { data, error } = await supabase
    .from("product_entitlements")
    .select("*")
    .eq("user_id", userId)
    .eq("product", PRODUCT_LEADSMART_AGENT)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as AgentEntitlement | null) ?? null;
}
