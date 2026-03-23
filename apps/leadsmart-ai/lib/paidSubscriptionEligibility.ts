/**
 * Same rules as Property Tools — shared Supabase project.
 * @see apps/property-tools/lib/paidSubscriptionEligibility.ts
 */
import { supabaseServer } from "@/lib/supabaseServer";

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
  "support",
]);

export function isRealEstateProfessionalRole(role: string | null | undefined): boolean {
  const r = String(role ?? "")
    .toLowerCase()
    .trim();
  return r !== "" && REAL_ESTATE_PROFESSIONAL_ROLES.has(r);
}

export type PaidSubscriptionEligibility = {
  allowed: boolean;
  reason: "professional_role" | "agent_record" | "consumer_permitted" | "denied";
};

export async function getPaidSubscriptionEligibility(
  userId: string
): Promise<PaidSubscriptionEligibility> {
  const allowConsumer = process.env.ALLOW_CONSUMER_PAID_SUBSCRIPTIONS !== "false";

  const { data: profile } = await supabaseServer
    .from("user_profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  const role = (profile as { role?: string } | null)?.role ?? null;

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
