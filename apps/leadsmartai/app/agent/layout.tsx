import { headers } from "next/headers";
import { ReactNode } from "react";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { AgentWorkspaceProviders } from "@/components/entitlements/AgentWorkspaceProviders";
import { ensureAgentWorkspaceAccess } from "@/lib/entitlements/agentAccess";
import { fetchUserPortalContext } from "@/lib/rolePortalServer";

/** Public marketing pages under /agent/* that bypass the workspace
 *  access check. Pathname is read from the `x-pathname` header
 *  forwarded by proxy.ts. Keep in sync with PUBLIC_AGENT_PATHS in
 *  proxy.ts. */
const PUBLIC_AGENT_PATHS = new Set<string>([
  "/agent/compare",
  "/agent/pricing",
]);

export default async function AgentPortalLayout({ children }: { children: ReactNode }) {
  const h = await headers();
  const pathname = h.get("x-pathname") ?? "";

  if (PUBLIC_AGENT_PATHS.has(pathname)) {
    // Public marketing surface — skip auth + entitlement checks +
    // skip the AgentWorkspaceProviders wrapper (which expects a
    // signed-in agent context).
    return <>{children}</>;
  }

  const supabase = supabaseServerClient();
  const ctx = await fetchUserPortalContext(supabase);
  await ensureAgentWorkspaceAccess(supabase, ctx);
  return <AgentWorkspaceProviders>{children}</AgentWorkspaceProviders>;
}
