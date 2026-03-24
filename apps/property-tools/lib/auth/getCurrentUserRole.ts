import { createClient } from "@/lib/supabase/server";
import { getCurrentUserWithProfile } from "./getCurrentUser";
import { parseUserRole, type UserRole } from "./roles";

/** Canonical RBAC roles (same as `UserRole` / `public.profiles.role`). */
export type AppRole = UserRole;

export type CurrentUserWithRole = {
  id: string;
  email: string | null;
  fullName: string | null;
  role: AppRole;
  /** From `profiles.agent_id` when present. */
  agentId: string | null;
  /** From `profiles.broker_id` when present. */
  brokerId: string | null;
  /** From `profiles.support_id` when present. */
  supportId: string | null;
};

/**
 * Server-only: current session + `profiles` row fields for routing and guards.
 * If `profiles` is missing (migration window), falls back to `getCurrentUserWithProfile()` logic.
 */
export async function getCurrentUserWithRole(): Promise<CurrentUserWithRole | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, agent_id, broker_id, support_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profileError && profile) {
    const row = profile as Record<string, unknown>;
    return {
      id: String(profile.id),
      email: profile.email != null ? String(profile.email) : null,
      fullName: profile.full_name != null ? String(profile.full_name) : null,
      role: parseUserRole(profile.role as string),
      agentId: row.agent_id != null ? String(row.agent_id) : null,
      brokerId: row.broker_id != null ? String(row.broker_id) : null,
      supportId: row.support_id != null ? String(row.support_id) : null,
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
