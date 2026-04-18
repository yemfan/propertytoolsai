import { getCurrentAgentContext } from "@/lib/dashboardService";
import { supabaseServer } from "@/lib/supabaseServer";
import ContactsClient from "./ContactsClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contacts",
  description: "Manage your contact database and client relationships.",
  keywords: ["contacts", "CRM", "client management"],
  robots: { index: false },
};

export default async function ContactsPage() {
  const ctx = await getCurrentAgentContext();

  const { data } = await supabaseServer
    .from("contacts")
    .select("id, name, email, phone, property_address, source, rating, last_contacted_at, notes, created_at")
    .eq("agent_id", ctx.agentId)
    .order("created_at", { ascending: false })
    .limit(500);

  return <ContactsClient leads={(data ?? []) as any[]} />;
}
