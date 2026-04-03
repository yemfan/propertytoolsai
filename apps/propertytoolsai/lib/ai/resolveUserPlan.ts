import { supabaseServer } from "@/lib/supabaseServer";

/**
 * Resolve billing/plan tier for rate limiting (`agents.plan_type` or `leadsmart_users.plan`).
 */
export async function resolveUserPlanType(userId: string): Promise<string> {
  try {
    const { data: agent } = await supabaseServer
      .from("agents")
      .select("plan_type")
      .eq("auth_user_id", userId)
      .maybeSingle();
    const fromAgent = String((agent as { plan_type?: string })?.plan_type ?? "").trim();
    if (fromAgent) return fromAgent;
  } catch {
    /* ignore */
  }

  try {
    const { data: ls } = await supabaseServer
      .from("leadsmart_users")
      .select("plan")
      .eq("user_id", userId)
      .maybeSingle();
    const fromLs = String((ls as { plan?: string })?.plan ?? "").trim();
    if (fromLs) return fromLs;
  } catch {
    /* ignore */
  }

  return "free";
}
