import { redirect } from "next/navigation";
import { getCurrentUserWithRole, type CurrentUserWithRole } from "@/lib/auth/getCurrentUser";
import { hasAgentWorkspaceAccess } from "@/lib/entitlements/agentAccess";
import { supabaseServerClient } from "@/lib/supabaseServerClient";

/**
 * Server Components: require signed-in user + LeadSmart AI Agent entitlement (or platform admin).
 * Uses cookie session via `getCurrentUserWithRole()` (no `Request`).
 */
export async function requireAgentAccess(): Promise<CurrentUserWithRole> {
  const user = await getCurrentUserWithRole();

  if (!user) {
    redirect("/login");
  }

  const supabase = supabaseServerClient();
  const hasAccess = await hasAgentWorkspaceAccess(supabase, user.id, user.role);

  if (!hasAccess) {
    redirect("/start-free/agent");
  }

  return user;
}
