import { ReactNode } from "react";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { AgentWorkspaceProviders } from "@/components/entitlements/AgentWorkspaceProviders";
import { ensureAgentWorkspaceAccess } from "@/lib/entitlements/agentAccess";
import { fetchUserPortalContext } from "@/lib/rolePortalServer";

export default async function AgentPortalLayout({ children }: { children: ReactNode }) {
  const supabase = supabaseServerClient();
  const ctx = await fetchUserPortalContext(supabase);
  await ensureAgentWorkspaceAccess(supabase, ctx);
  return <AgentWorkspaceProviders>{children}</AgentWorkspaceProviders>;
}
