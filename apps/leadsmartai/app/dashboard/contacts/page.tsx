import { getCurrentAgentContext } from "@/lib/dashboardService";
import { supabaseServer } from "@/lib/supabaseServer";
import ContactsClient from "./ContactsClient";

export default async function ContactsPage() {
  const ctx = await getCurrentAgentContext();

  const { data } = await supabaseServer
    .from("leads")
    .select("id, name, email, phone, property_address, source, rating, last_contacted_at, notes, created_at")
    .eq("agent_id", ctx.agentId)
    .order("created_at", { ascending: false })
    .limit(500);

  return <ContactsClient leads={(data ?? []) as any[]} />;
}
