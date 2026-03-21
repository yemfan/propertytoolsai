import { getCurrentAgentContext } from "@/lib/dashboardService";
import PresentationsClient from "@/app/dashboard/presentations/PresentationsClient";
import { supabaseServer } from "@/lib/supabaseServer";

export default async function PresentationsPage() {
  const ctx = await getCurrentAgentContext();

  const { data } = await supabaseServer
    .from("presentations")
    .select("id,property_address,created_at")
    .eq("agent_id", ctx.agentId)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <PresentationsClient
      agentId={ctx.agentId}
      initialPresentations={((data ?? []) as any) ?? []}
    />
  );
}

