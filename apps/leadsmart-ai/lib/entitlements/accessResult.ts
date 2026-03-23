import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { getAgentEntitlement } from "@/lib/entitlements/getEntitlements";
import { getTodayUsage } from "@/lib/entitlements/usage";
import type { AccessResult } from "@/lib/entitlements/types";

/**
 * User-scoped checks (RLS): pass `userId` only; uses the request Supabase server client.
 * Simpler than `limits.ts` (daily counters for leads/contacts vs live CRM counts in `limits.ts`).
 *
 * Import as `import { accessResult } from "@/lib/entitlements"` to avoid clashing with `agentAccess.hasAgentWorkspaceAccess`.
 */

export async function hasAgentWorkspaceAccess(userId: string): Promise<boolean> {
  const supabase = supabaseServerClient();
  const entitlement = await getAgentEntitlement(supabase, userId);
  return !!entitlement?.is_active;
}

export async function canCreateCma(userId: string): Promise<AccessResult> {
  const supabase = supabaseServerClient();
  const entitlement = await getAgentEntitlement(supabase, userId);
  if (!entitlement) {
    return {
      allowed: false,
      reason: "no_agent_entitlement",
      plan: null,
      currentUsage: null,
      limit: null,
    };
  }

  const usage = await getTodayUsage(supabase, userId);

  const current = usage?.cma_reports_used ?? 0;
  const limit = entitlement.cma_reports_per_day;

  if (limit !== null && current >= limit) {
    return {
      allowed: false,
      reason: "cma_limit_reached",
      plan: entitlement.plan,
      currentUsage: current,
      limit,
    };
  }

  return {
    allowed: true,
    reason: null,
    plan: entitlement.plan,
    currentUsage: current,
    limit,
  };
}

export async function canAddLead(userId: string): Promise<AccessResult> {
  const supabase = supabaseServerClient();
  const entitlement = await getAgentEntitlement(supabase, userId);
  if (!entitlement) {
    return {
      allowed: false,
      reason: "no_agent_entitlement",
      plan: null,
      currentUsage: null,
      limit: null,
    };
  }

  const usage = await getTodayUsage(supabase, userId);
  const current = usage?.leads_used ?? 0;
  const limit = entitlement.max_leads;

  if (limit !== null && current >= limit) {
    return {
      allowed: false,
      reason: "lead_limit_reached",
      plan: entitlement.plan,
      currentUsage: current,
      limit,
    };
  }

  return {
    allowed: true,
    reason: null,
    plan: entitlement.plan,
    currentUsage: current,
    limit,
  };
}

export async function canAddContact(userId: string): Promise<AccessResult> {
  const supabase = supabaseServerClient();
  const entitlement = await getAgentEntitlement(supabase, userId);
  if (!entitlement) {
    return {
      allowed: false,
      reason: "no_agent_entitlement",
      plan: null,
      currentUsage: null,
      limit: null,
    };
  }

  const usage = await getTodayUsage(supabase, userId);
  const current = usage?.contacts_used ?? 0;
  const limit = entitlement.max_contacts;

  if (limit !== null && current >= limit) {
    return {
      allowed: false,
      reason: "contact_limit_reached",
      plan: entitlement.plan,
      currentUsage: current,
      limit,
    };
  }

  return {
    allowed: true,
    reason: null,
    plan: entitlement.plan,
    currentUsage: current,
    limit,
  };
}

export async function canDownloadFullReport(userId: string): Promise<AccessResult> {
  const supabase = supabaseServerClient();
  const entitlement = await getAgentEntitlement(supabase, userId);
  if (!entitlement) {
    return {
      allowed: false,
      reason: "no_agent_entitlement",
      plan: null,
      currentUsage: null,
      limit: null,
    };
  }

  const level = entitlement.reports_download_level;
  const allowed = level === "full" || level === "unlimited";

  return {
    allowed,
    reason: allowed ? null : "download_limit_reached",
    plan: entitlement.plan,
    currentUsage: null,
    limit: null,
  };
}

export async function canInviteTeam(userId: string): Promise<AccessResult> {
  const supabase = supabaseServerClient();
  const entitlement = await getAgentEntitlement(supabase, userId);
  if (!entitlement) {
    return {
      allowed: false,
      reason: "no_agent_entitlement",
      plan: null,
      currentUsage: null,
      limit: null,
    };
  }

  return {
    allowed: entitlement.team_access,
    reason: entitlement.team_access ? null : "team_access_not_enabled",
    plan: entitlement.plan,
    currentUsage: null,
    limit: null,
  };
}
