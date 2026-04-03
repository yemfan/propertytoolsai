import { createClient } from "@/lib/supabase/server";
import { getCurrentUserWithProfile } from "./getCurrentUser";
import { parseUserRole, type UserRole } from "./roles";

/** Canonical RBAC roles (same as `UserRole`; stored in `leadsmart_users.role`, `user` → consumer). */
export type AppRole = UserRole;

export type CurrentUserWithRole = {
  id: string;
  email: string | null;
  fullName: string | null;
  role: AppRole;
  /** From `leadsmart_users.agent_id` when present. */
  agentId: string | null;
  /** From `leadsmart_users.broker_id` when present. */
  brokerId: string | null;
  /** From `leadsmart_users.support_id` when present. */
  supportId: string | null;
};

/**
 * Server-only: current session + merged `user_profiles` / `leadsmart_users` for routing and guards.
 */
export async function getCurrentUserWithRole(): Promise<CurrentUserWithRole | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("user_id, email, full_name, leadsmart_users(role,agent_id,broker_id,support_id)")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profileError && profile) {
    const row = profile as Record<string, unknown>;
    const lsRaw = row.leadsmart_users;
    const ls = lsRaw == null ? null : Array.isArray(lsRaw) ? lsRaw[0] : (lsRaw as Record<string, unknown>);
    const rawRole = String(ls?.role ?? "").toLowerCase().trim();
    const rbacRole =
      rawRole === "user" || rawRole === "" ? "consumer" : parseUserRole(ls?.role as string);
    return {
      id: String(row.user_id ?? user.id),
      email: row.email != null ? String(row.email) : null,
      fullName: row.full_name != null ? String(row.full_name) : null,
      role: rbacRole,
      agentId: ls?.agent_id != null ? String(ls.agent_id) : null,
      brokerId: ls?.broker_id != null ? String(ls.broker_id) : null,
      supportId: ls?.support_id != null ? String(ls.support_id) : null,
    };
  }

  const fallback = await getCurrentUserWithProfile();
  if (!fallback) return null;

  return {
    id: fallback.profile.id,
    email: fallback.profile.email,
    fullName: fallback.profile.full_name,
    role: fallback.profile.role,
    agentId: fallback.profile.agent_id ?? null,
    brokerId: fallback.profile.broker_id ?? null,
    supportId: fallback.profile.support_id ?? null,
  };
}
