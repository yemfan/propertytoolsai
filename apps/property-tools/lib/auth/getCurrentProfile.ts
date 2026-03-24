import { getCurrentUserWithProfile } from "@/lib/auth/getCurrentUser";
import type { ProfileRow } from "@/lib/auth/profileTypes";
import { resolveCrmAgentIdForUser } from "@/lib/dashboard/agent";

/**
 * Authenticated user + profile, with CRM `agents.id` when linked.
 * `agent_id` is the numeric string used on `public.leads.agent_id` — not the auth UUID.
 * Prefers `profiles.agent_id` when set; otherwise resolves via `agents.auth_user_id`.
 */
export type CurrentProfile = ProfileRow & {
  userId: string;
  agent_id: string | null;
  broker_id: string | null;
  support_id: string | null;
};

export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const ctx = await getCurrentUserWithProfile();
  if (!ctx) return null;

  const resolvedAgent = await resolveCrmAgentIdForUser(ctx.user.id);
  const stored = ctx.profile.agent_id?.trim();
  const agent_id = stored && stored.length > 0 ? stored : resolvedAgent;

  return {
    ...ctx.profile,
    userId: ctx.user.id,
    agent_id,
    broker_id: ctx.profile.broker_id ?? null,
    support_id: ctx.profile.support_id ?? null,
  };
}
