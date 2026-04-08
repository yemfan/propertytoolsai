import { supabaseServer } from "@/lib/supabaseServer";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import OpenHousesClient from "./OpenHousesClient";

export default async function OpenHousesPage() {
  const { agentId, userId } = await getCurrentAgentContext();
  const signupAgentKey = agentId || userId;

  const { data: propertiesData } = await supabaseServer
    .from("properties_warehouse")
    .select("id,address,city,state,zip_code")
    .order("updated_at", { ascending: false })
    .limit(50);

  return (
    <OpenHousesClient
      agentId={signupAgentKey}
      properties={(propertiesData ?? []) as any[]}
    />
  );
}
