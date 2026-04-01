import type { User } from "@supabase/supabase-js";

/** Marketing headline for anonymous visitors only — do not use for signed-in users. */
export const START_FREE_AS_AGENT_LABEL = "Start Free as Agent";

/**
 * Whether to show the public “Start free as agent” marketing entry points
 * (signup modal, home funnel, login footer, etc.). Signed-in users should use
 * account/pricing/activation flows instead.
 */
export function showStartFreeAsAgentMarketing(user: User | null | undefined): boolean {
  return user == null;
}

/** Primary CTA for signed-in consumers who are not yet on an agent plan. */
export const LOGGED_IN_GET_AGENT_ACCESS_LABEL = "Get agent access";

/** Signed-in users without agent product — pricing hub and similar. */
export const LOGGED_IN_VIEW_AGENT_PLANS_LABEL = "View agent plans";

/** Staff / cross-product — no “start free” framing. */
export const LOGGED_IN_VIEW_AGENT_PRICING_LABEL = "View agent pricing";

/** Platform role `agent` but billing/entitlement not active yet. */
export const LOGGED_IN_ACTIVATE_AGENT_ACCESS_LABEL = "Activate agent access";
