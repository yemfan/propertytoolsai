import { getCurrentAgentContext } from "@/lib/dashboardService";
import { supabaseServer } from "@/lib/supabaseServer";
import CalendarClient from "./CalendarClient";

export default async function CalendarPage() {
  const ctx = await getCurrentAgentContext();

  const { data: leads } = await supabaseServer
    .from("leads")
    .select("id, name")
    .eq("agent_id", ctx.agentId)
    .limit(500);

  return (
    <CalendarClient
      leads={(leads ?? []).map((l: any) => ({ id: String(l.id), name: l.name }))}
    />
  );
}
