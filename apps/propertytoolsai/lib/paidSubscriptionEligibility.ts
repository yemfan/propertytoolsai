/**
 * Paid PropertyTools plans are intended for real estate professionals (agents, brokers, teams).
 * Consumers may still subscribe unless ALLOW_CONSUMER_PAID_SUBSCRIPTIONS=false.
 */
import { supabaseServer } from "@/lib/supabaseServer";

/** Roles that qualify as industry professionals for dashboard + paid access. */
export const REAL_ESTATE_PROFESSIONAL_ROLES = new Set([
  "agent",
  "broker",
  "broker_owner",
  "managing_broker",
  "team_lead",
  "brokerage_admin",
  "owner",
  "partner",
  "admin",
  "loan_broker",
]);

export function isRealEstateProfessionalRole(role: string | null | undefined): boolean {
  const r = String(role ?? "")
    .toLowerCase()
    .trim();
  return r !== "" && REAL_ESTATE_PROFESSIONAL_ROLES.has(r);
}

export type PaidSubscriptionEligibility = {
  allowed: boolean;
  /** Why checkout is allowed (or blocked). */
  reason: "professional_role" | "agent_record" | "consumer_permitted" | "denied";
};

/**
 * - Professionals (role or agents row) → always allowed to start a paid subscription.
 * - Everyone else → allowed unless ALLOW_CONSUMER_PAID_SUBSCRIPTIONS=false.
 */
export async function getPaidSubscriptionEligibility(
  userId: string
): Promise<PaidSubscriptionEligibility> {
  const allowConsumer = process.env.ALLOW_CONSUMER_PAID_SUBSCRIPTIONS !== "false";

  const { data: ls } = await supabaseServer
    .from("leadsmart_users")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  const role = (ls as { role?: string } | null)?.role ?? null;

  if (isRealEstateProfessionalRole(role)) {
    return { allowed: true, reason: "professional_role" };
  }

  const { data: agentRow } = await supabaseServer
    .from("agents")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (agentRow) {
    return { allowed: true, reason: "agent_record" };
  }

  if (allowConsumer) {
    return { allowed: true, reason: "consumer_permitted" };
  }

  return { allowed: false, reason: "denied" };
}
