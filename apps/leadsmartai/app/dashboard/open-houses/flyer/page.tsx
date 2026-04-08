import { supabaseServer } from "@/lib/supabaseServer";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import FlyerBuilderClient from "./FlyerBuilderClient";

export const metadata = {
  title: "Open House Flyer Builder | LeadSmart AI",
  description: "Create a professional open house flyer with property details, photos, and QR code.",
};

export default async function FlyerBuilderPage() {
  const { agentId, userId } = await getCurrentAgentContext();

  const { data: properties } = await supabaseServer
    .from("properties_warehouse")
    .select("id,address,city,state,zip_code")
    .order("updated_at", { ascending: false })
    .limit(50);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <FlyerBuilderClient
        agentId={agentId || userId}
        properties={(properties ?? []) as any[]}
      />
    </div>
  );
}
