import { supabaseServer } from "@/lib/supabaseServer";

/**
 * Resolve billing/plan tier for rate limiting (agents.plan_type or leadsmart_users.plan).
 */
export async function resolveUserPlanType(userId: string): Promise<string> {
  try {
    const { data: agent } = await supabaseServer
      .from("agents")
      .select("plan_type")
      .eq("auth_user_id", userId)
      .maybeSingle();
    const fromAgent = String((agent as any)?.plan_type ?? "").trim();
    if (fromAgent) return fromAgent;
  } catch {
    /* ignore */
  }

  try {
    const { data: profile } = await supabaseServer
      .from("leadsmart_users")
      .select("plan")
      .eq("user_id", userId)
      .maybeSingle();
    const fromProfile = String((profile as { plan?: string } | null)?.plan ?? "").trim();
    if (fromProfile) return fromProfile;
  } catch {
    /* ignore */
  }

  return "free";
}
