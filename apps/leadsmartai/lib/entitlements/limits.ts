import type { SupabaseClient } from "@supabase/supabase-js";
import { PRODUCT_LEADSMART_AGENT } from "./product";
import { getActiveAgentEntitlement } from "./getEntitlements";
import {
  countContactsForAgent,
  countLeadsForAgent,
  getAgentNumericId,
  getTodayUsage,
} from "./usage";
import { PLAN_CATALOG } from "./planCatalog";
import type { AgentPlan, EntitlementCheckResult, LimitReason } from "./types";

/** Negative = unlimited (legacy rows); NULL = unlimited (DB convention for Elite). */
export function isUnlimitedLeadOrContactCap(n: number | null | undefined): boolean {
  if (n == null) return true;
  return typeof n === "number" && n < 0;
}

/** CMA cap: null or negative = unlimited / unset */
export function isUnlimitedCap(n: number | null | undefined): boolean {
  if (n == null) return true;
  return typeof n === "number" && n < 0;
}

export async function canCreateCma(
  supabase: SupabaseClient,
  userId: string
): Promise<EntitlementCheckResult> {
  const ent = await getActiveAgentEntitlement(supabase, userId);
  if (!ent) {
    return {
      allowed: false,
      reason: "No active LeadSmart Agent entitlement.",
      reasonCode: "no_agent_entitlement",
      plan: null,
      product: PRODUCT_LEADSMART_AGENT,
      currentUsage: {},
      limit: null,
    };
  }
  const cap = ent.cma_reports_per_day;
  if (isUnlimitedCap(cap)) {
    return {
      allowed: true,
      reason: null,
      reasonCode: null,
      plan: ent.plan,
      product: ent.product,
      currentUsage: { cmaToday: 0 },
      limit: null,
    };
  }
  const today = await getTodayUsage(supabase, userId);
  const used = today?.cma_reports_used ?? 0;
  const allowed = cap != null && used < cap;
  return {
    allowed,
    reason: allowed
      ? null
      : `You’ve used all CMA reports for today (${used}/${cap}). Upgrade to unlock more daily reports.`,
    reasonCode: allowed ? null : ("cma_limit_reached" satisfies LimitReason),
    plan: ent.plan,
    product: ent.product,
    currentUsage: { cmaToday: used },
    limit: cap,
  };
}

export async function canAddLead(
  supabase: SupabaseClient,
  userId: string
): Promise<EntitlementCheckResult> {
  const ent = await getActiveAgentEntitlement(supabase, userId);
  if (!ent) {
    return {
      allowed: false,
      reason: "No active LeadSmart Agent entitlement.",
      reasonCode: "no_agent_entitlement",
      plan: null,
      product: PRODUCT_LEADSMART_AGENT,
      currentUsage: {},
      limit: null,
    };
  }
  const cap = ent.max_leads;
  const agentId = await getAgentNumericId(supabase, userId);
  const used = agentId ? await countLeadsForAgent(supabase, agentId) : 0;
  if (isUnlimitedLeadOrContactCap(cap)) {
    return {
      allowed: true,
      reason: null,
      reasonCode: null,
      plan: ent.plan,
      product: ent.product,
      currentUsage: { leads: used },
      limit: null,
    };
  }
  const allowed = cap != null && used < cap;
  return {
    allowed,
    reason: allowed
      ? null
      : `You’ve reached your ${formatPlanLabel(ent.plan)} lead limit (${used}/${cap}). Upgrade to Growth to manage up to 500 leads.`,
    reasonCode: allowed ? null : ("lead_limit_reached" satisfies LimitReason),
    plan: ent.plan,
    product: ent.product,
    currentUsage: { leads: used },
    limit: cap,
  };
}

export async function canAddContact(
  supabase: SupabaseClient,
  userId: string
): Promise<EntitlementCheckResult> {
  const ent = await getActiveAgentEntitlement(supabase, userId);
  if (!ent) {
    return {
      allowed: false,
      reason: "No active LeadSmart Agent entitlement.",
      reasonCode: "no_agent_entitlement",
      plan: null,
      product: PRODUCT_LEADSMART_AGENT,
      currentUsage: {},
      limit: null,
    };
  }
  const cap = ent.max_contacts;
  const agentId = await getAgentNumericId(supabase, userId);
  const used = agentId ? await countContactsForAgent(supabase, agentId) : 0;
  if (isUnlimitedLeadOrContactCap(cap)) {
    return {
      allowed: true,
      reason: null,
      reasonCode: null,
      plan: ent.plan,
      product: ent.product,
      currentUsage: { contacts: used },
      limit: null,
    };
  }
  const allowed = cap != null && used < cap;
  return {
    allowed,
    reason: allowed
      ? null
      : `You’ve reached your CRM contact limit (${used}/${cap}) on ${formatPlanLabel(ent.plan)}. Upgrade for a higher cap.`,
    reasonCode: allowed ? null : ("contact_limit_reached" satisfies LimitReason),
    plan: ent.plan,
    product: ent.product,
    currentUsage: { contacts: used },
    limit: cap,
  };
}

export async function canDownloadFullReport(
  supabase: SupabaseClient,
  userId: string
): Promise<EntitlementCheckResult> {
  const ent = await getActiveAgentEntitlement(supabase, userId);
  if (!ent) {
    return {
      allowed: false,
      reason: "No active LeadSmart Agent entitlement.",
      reasonCode: "no_agent_entitlement",
      plan: null,
      product: PRODUCT_LEADSMART_AGENT,
      currentUsage: {},
      limit: null,
    };
  }
  const level = String(ent.reports_download_level ?? "").toLowerCase();
  const today = await getTodayUsage(supabase, userId);
  const used = today?.report_downloads_used ?? 0;

  if (level === "limited") {
    const cap = 3;
    const allowed = used < cap;
    return {
      allowed,
      reason: allowed
        ? null
        : "You’ve reached your daily report download limit on Starter. Upgrade to Growth for full exports.",
      reasonCode: allowed ? null : ("download_limit_reached" satisfies LimitReason),
      plan: ent.plan,
      product: ent.product,
      currentUsage: { reportDownloadsToday: used },
      limit: cap,
    };
  }

  if (level === "full" || level === "unlimited") {
    return {
      allowed: true,
      reason: null,
      reasonCode: null,
      plan: ent.plan,
      product: ent.product,
      currentUsage: { reportDownloadsToday: used },
      limit: null,
    };
  }

  return {
    allowed: false,
    reason: "Report downloads are not enabled on your current plan.",
    reasonCode: null,
    plan: ent.plan,
    product: ent.product,
    currentUsage: { reportDownloadsToday: used },
    limit: 0,
  };
}

export async function canInviteTeam(
  supabase: SupabaseClient,
  userId: string
): Promise<EntitlementCheckResult> {
  const ent = await getActiveAgentEntitlement(supabase, userId);
  if (!ent) {
    return {
      allowed: false,
      reason: "No active LeadSmart Agent entitlement.",
      reasonCode: "no_agent_entitlement",
      plan: null,
      product: PRODUCT_LEADSMART_AGENT,
      currentUsage: {},
      limit: null,
    };
  }
  const allowed = ent.team_access === true;
  return {
    allowed,
    reason: allowed ? null : "Team access is available on Elite. Upgrade to invite collaborators.",
    reasonCode: allowed ? null : ("team_access_not_enabled" satisfies LimitReason),
    plan: ent.plan,
    product: ent.product,
    currentUsage: {},
    limit: ent.team_access ? 1 : 0,
  };
}

function formatPlanLabel(plan: string): string {
  const id = plan.toLowerCase() as AgentPlan;
  return PLAN_CATALOG[id]?.label ?? plan;
}
