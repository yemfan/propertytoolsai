import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { mapLegacyUserProfileRoleToRbac } from "./mapLegacyRole";
import type { ProfileRow } from "./profileTypes";
import { parseUserRole, type UserRole } from "./roles";

export type SessionUserWithProfile = {
  user: User;
  profile: ProfileRow;
};

/**
 * Authenticated Supabase user from the App Router cookie session.
 * Throws on auth transport errors; returns `null` when there is no session.
 */
export async function getCurrentUser() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  return user;
}

function normalizeProfileRow(row: Record<string, unknown>): ProfileRow {
  const id = String(row.id ?? "");
  const role = parseUserRole(row.role as string);
  return {
    id,
    email: row.email != null ? String(row.email) : null,
    full_name: row.full_name != null ? String(row.full_name) : null,
    role,
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
    agent_id: row.agent_id != null ? String(row.agent_id) : null,
    broker_id: row.broker_id != null ? String(row.broker_id) : null,
    support_id: row.support_id != null ? String(row.support_id) : null,
  };
}

/**
 * Returns the authenticated Supabase user + `public.profiles` row.
 * Falls back to legacy `user_profiles` for role/name when `profiles` is missing (migration window).
 */
export async function getCurrentUserWithProfile(): Promise<SessionUserWithProfile | null> {
  const supabase = supabaseServerClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) return null;

  const { data: profileRow, error: profileErr } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,agent_id,broker_id,support_id,created_at,updated_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profileErr) {
    console.error("[getCurrentUserWithProfile] profiles:", profileErr.message);
  }

  if (profileRow) {
    return {
      user,
      profile: normalizeProfileRow(profileRow as Record<string, unknown>),
    };
  }

  const { data: legacy } = await supabase
    .from("user_profiles")
    .select("full_name,role")
    .eq("user_id", user.id)
    .maybeSingle();

  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const fullName =
    (legacy as { full_name?: string } | null)?.full_name ??
    (typeof meta?.full_name === "string" ? meta.full_name : null);

  const rbacRole: UserRole = mapLegacyUserProfileRoleToRbac(
    (legacy as { role?: string } | null)?.role
  );

  const synthetic: ProfileRow = {
    id: user.id,
    email: user.email ?? null,
    full_name: fullName,
    role: rbacRole,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    agent_id: null,
    broker_id: null,
    support_id: null,
  };

  return { user, profile: synthetic };
}

export {
  getCurrentUserWithRole,
  type AppRole,
  type CurrentUserWithRole,
} from "./getCurrentUserRole";
