import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Shared helper for admin log pages: batch-resolve an agent id list
 * into display names + emails. Returns a Map for O(1) lookup in
 * page renderers.
 *
 * Uses supabase.auth.admin.getUserById to fetch each email, because
 * auth.users isn't directly joinable from the public schema. Failures
 * are swallowed per-agent — a missing email just renders as null.
 */
export type AgentDisplay = {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
};

export async function resolveAgentDisplays(
  agentIds: string[],
): Promise<Map<string, AgentDisplay>> {
  const out = new Map<string, AgentDisplay>();
  if (agentIds.length === 0) return out;

  const { data: agents } = await supabaseAdmin
    .from("agents")
    .select("id, first_name, last_name, auth_user_id")
    .in("id", agentIds);

  type AgentRow = {
    id: string | number;
    first_name: string | null;
    last_name: string | null;
    auth_user_id: string | null;
  };
  for (const a of ((agents ?? []) as AgentRow[])) {
    let email: string | null = null;
    if (a.auth_user_id) {
      try {
        const { data } = await supabaseAdmin.auth.admin.getUserById(String(a.auth_user_id));
        email = data?.user?.email ?? null;
      } catch {
        email = null;
      }
    }
    out.set(String(a.id), {
      email,
      firstName: a.first_name,
      lastName: a.last_name,
    });
  }
  return out;
}
