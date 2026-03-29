import type { User } from "@supabase/supabase-js";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { isRealEstateProfessionalRole } from "@/lib/paidSubscriptionEligibility";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServerClient } from "@/lib/supabaseServerClient";

/**
 * Canonical `user_profiles.role` values used for route guards (lowercase).
 * Extend as new roles are added.
 */
export type AppRole =
  | "agent"
  | "loan_broker"
  | "admin"
  | "support"
  | "broker"
  | "broker_owner"
  | "managing_broker"
  | "team_lead"
  | "brokerage_admin"
  | "owner"
  | "partner"
  | "consumer"
  | "user";

/**
 * Authenticated user + profile fields.
 * - **No `req`:** Server Components / cookie session (`supabase.auth.getUser()`).
 * - **With `req`:** API routes — `getUserFromRequest` (cookies + optional Bearer), then service-role reads.
 */
export type CurrentUserWithRole = {
  id: string;
  /** From Supabase Auth (needed for Stripe checkout, etc.) */
  email: string | null;
  role: string | null;
  hasAgentRow: boolean;
  isPro: boolean;
};

async function enrichUser(user: User): Promise<CurrentUserWithRole> {

  const userId = user.id;
  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  const role = profile?.role ?? null;
  const { data: agentRow } = await supabaseAdmin
    .from("agents")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle();
  const hasAgentRow = !!agentRow;
  const isPro = isRealEstateProfessionalRole(role) || hasAgentRow;

  return { id: userId, email: user.email ?? null, role, hasAgentRow, isPro };
}

export async function getCurrentUserWithRole(req?: Request): Promise<CurrentUserWithRole | null> {
  let user: User | null = null;
  if (req) {
    user = await getUserFromRequest(req);
  } else {
    const supabase = supabaseServerClient();
    const {
      data: { user: u },
    } = await supabase.auth.getUser();
    user = u ?? null;
  }
  if (!user) return null;
  return enrichUser(user);
}
