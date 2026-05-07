import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Shared helper for admin log pages: batch-resolve an agent id list
 * into display names + emails. Returns a Map for O(1) lookup in
 * page renderers.
 *
 * Source of truth is `auth.users.user_metadata` for both names and
 * email — `agents` does NOT have name columns in this codebase
 * (information_schema confirms only id / auth_user_id / brand_name /
 * forwarding_phone / etc). The previous SELECT included
 * first_name + last_name which silently errored the entire query
 * out, returning an empty map and rendering blank names on every
 * admin page. Same class of bug fixed in PR #326 for missed-call
 * settings.
 *
 * Failures (auth admin lookup throws, metadata empty, etc.) are
 * swallowed per-agent — a missing record just renders as nulls.
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
    .select("id, auth_user_id, brand_name")
    .in("id", agentIds);

  type AgentRow = {
    id: string | number;
    auth_user_id: string | null;
    brand_name: string | null;
  };

  for (const a of ((agents ?? []) as AgentRow[])) {
    let email: string | null = null;
    let firstName: string | null = null;
    let lastName: string | null = null;

    if (a.auth_user_id) {
      try {
        const { data } = await supabaseAdmin.auth.admin.getUserById(
          String(a.auth_user_id),
        );
        email = data?.user?.email ?? null;
        const meta = (data?.user?.user_metadata ?? {}) as {
          full_name?: unknown;
          name?: unknown;
          first_name?: unknown;
          last_name?: unknown;
        };

        // Prefer explicit first_name / last_name when present, then
        // fall back to splitting full_name / name on the first space.
        // Rest-of-string after the first space becomes the last name
        // so "Jane van der Berg" lands as ("Jane", "van der Berg")
        // rather than a one-token last name.
        if (typeof meta.first_name === "string" && meta.first_name.trim()) {
          firstName = meta.first_name.trim();
        }
        if (typeof meta.last_name === "string" && meta.last_name.trim()) {
          lastName = meta.last_name.trim();
        }
        if (!firstName && !lastName) {
          const composite =
            (typeof meta.full_name === "string" && meta.full_name.trim()) ||
            (typeof meta.name === "string" && meta.name.trim()) ||
            "";
          if (composite) {
            const spaceIdx = composite.indexOf(" ");
            if (spaceIdx === -1) {
              firstName = composite;
            } else {
              firstName = composite.slice(0, spaceIdx);
              lastName = composite.slice(spaceIdx + 1).trim() || null;
            }
          }
        }
      } catch {
        // Auth admin lookup failed — leave fields null. Caller
        // renders "—" or similar.
      }
    }

    // Final fallback for firstName: brand_name on the agents row.
    // Useful for service accounts that don't have an auth user.
    if (!firstName && a.brand_name) firstName = a.brand_name;

    out.set(String(a.id), { email, firstName, lastName });
  }
  return out;
}
