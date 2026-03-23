import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import {
  AGENT_DASHBOARD_HOME_PATH,
  LOAN_BROKER_HOME_PATH,
  START_FREE_AGENT_PATH,
  BROKER_PORTAL_ROLES,
  resolveRoleHomePath,
} from "@/lib/rolePortalPaths";
import type { UserPortalContext } from "@/lib/rolePortalServer";
import { getActiveAgentEntitlement } from "./getEntitlements";

/**
 * Workspace access: active `leadsmart_agent` entitlement OR platform admin (ops preview).
 */
export async function hasAgentWorkspaceAccess(
  supabase: SupabaseClient,
  userId: string,
  role: string | null
): Promise<boolean> {
  const r = String(role ?? "").toLowerCase().trim();
  if (r === "admin") {
    return true;
  }
  const ent = await getActiveAgentEntitlement(supabase, userId);
  return !!ent && ent.is_active === true;
}

/**
 * `/agent/**` — requires active `leadsmart_agent` entitlement (or platform admin).
 * Other professional portals are routed to their home first.
 */
export async function ensureAgentWorkspaceAccess(
  supabase: SupabaseClient,
  ctx: UserPortalContext | null
): Promise<void> {
  const loginQs = new URLSearchParams({
    next: AGENT_DASHBOARD_HOME_PATH,
    redirect: AGENT_DASHBOARD_HOME_PATH,
  });

  if (!ctx) {
    redirect(`/login?${loginQs.toString()}`);
  }

  const r = String(ctx.role ?? "").toLowerCase().trim();
  if (r === "loan_broker") {
    redirect(LOAN_BROKER_HOME_PATH);
  }
  if (BROKER_PORTAL_ROLES.has(r) || r === "support") {
    redirect(resolveRoleHomePath(ctx.role, ctx.hasAgentRow));
  }

  const ok = await hasAgentWorkspaceAccess(supabase, ctx.userId, ctx.role);
  if (!ok) {
    redirect(START_FREE_AGENT_PATH);
  }
}
