import "server-only";

import { PLAN_CATALOG } from "@/lib/entitlements/planCatalog";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AgentPlan } from "@/lib/entitlements/types";

/**
 * Pre-flight checks for team-creation paths. Two surfaces use this:
 *   - The Create-Team server action — to block creating a team that
 *     can never invite anyone (avoids the dead-end where an agent
 *     creates a team on Starter, then every invite fails)
 *   - The /dashboard/team page — to render an "Upgrade to Elite" CTA
 *     instead of the Create form for non-eligible plans
 *
 * Resolves the agent's auth_user_id, looks up their active product
 * entitlement, and reads `teamAccess` from the plan catalog.
 */

export type TeamAccessStatus = {
  /** True only if the agent's plan has team_access AND active entitlement. */
  canCreate: boolean;
  plan: AgentPlan | null;
  /** Why canCreate is false — used by the UI to render the right
   *  empty state ("Upgrade to Elite" vs. "We couldn't find your
   *  subscription"). */
  reason: "ok" | "team_access_not_enabled" | "no_entitlement" | "no_user";
};

export async function getTeamAccessStatus(
  agentId: string,
): Promise<TeamAccessStatus> {
  try {
    const { data: agent } = await supabaseAdmin
      .from("agents")
      .select("auth_user_id")
      .eq("id", agentId)
      .maybeSingle();
    const userId = (agent as { auth_user_id: string | null } | null)?.auth_user_id ?? null;
    if (!userId) {
      return { canCreate: false, plan: null, reason: "no_user" };
    }

    const { data: entRow } = await supabaseAdmin
      .from("product_entitlements")
      .select("plan, team_access, is_active")
      .eq("user_id", userId)
      .eq("product", "leadsmart_agent")
      .eq("is_active", true)
      .maybeSingle();
    const ent = entRow as
      | { plan: AgentPlan | null; team_access: boolean | null; is_active: boolean }
      | null;

    if (!ent || !ent.plan) {
      return { canCreate: false, plan: null, reason: "no_entitlement" };
    }

    const planCatalog = PLAN_CATALOG[ent.plan];
    const canCreate = Boolean(ent.team_access) && planCatalog.teamAccess;
    return {
      canCreate,
      plan: ent.plan,
      reason: canCreate ? "ok" : "team_access_not_enabled",
    };
  } catch (e) {
    console.warn("[teams.access] unexpected error:", e);
    return { canCreate: false, plan: null, reason: "no_entitlement" };
  }
}
