import { supabaseServer } from "@/lib/supabaseServer";
import { getCurrentAgentContext, getLeads } from "@/lib/dashboardService";
import OpenHousesClient from "./OpenHousesClient";

export default async function OpenHousesPage() {
  const { agentId, userId } = await getCurrentAgentContext();
  const signupAgentKey = agentId || userId;

  const { data: propertiesData, error: propertiesErr } = await supabaseServer
    .from("properties_warehouse")
    .select("id,address,city,state,zip_code")
    .order("updated_at", { ascending: false })
    .limit(30);

  // Open house signups are stored in `leads` with source = "Open House".
  const openHouseLeads = await getLeads({ source: "Open House", limit: 500 });

  const properties = (propertiesData ?? []) as any[];
  if (propertiesErr) {
    console.error("OpenHousesPage properties load failed", propertiesErr);
  }

  return (
    <OpenHousesClient
      agentId={signupAgentKey}
      properties={properties}
      leads={openHouseLeads as any}
    />
  );
}

