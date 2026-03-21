import { supabaseServer } from "@/lib/supabaseServer";
import type { User } from "@supabase/supabase-js";

export type ClientPortalLead = {
  id: string;
  agent_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  property_address: string | null;
  lead_status: string | null;
  source: string | null;
  report_id: string | null;
  price_min: number | null;
  price_max: number | null;
  search_location: string | null;
  ai_lead_score: number | null;
  ai_intent: string | null;
  ai_timeline: string | null;
  ai_confidence: number | null;
  last_activity_at: string | null;
  next_contact_at: string | null;
  created_at: string | null;
};

/**
 * Resolve CRM lead rows for the logged-in client (email match).
 * Agents can still open the portal; they see leads tied to their email if any.
 */
export async function findLeadsForPortalUser(
  user: User,
  preferredLeadId?: string | null
): Promise<ClientPortalLead[]> {
  const email = (user.email ?? "").trim().toLowerCase();
  if (!email) return [];

  const { data, error } = await supabaseServer
    .from("leads")
    .select(
      "id,agent_id,name,email,phone,property_address,lead_status,source,report_id,price_min,price_max,search_location,ai_lead_score,ai_intent,ai_timeline,ai_confidence,last_activity_at,next_contact_at,created_at"
    )
    .ilike("email", email)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    console.error("findLeadsForPortalUser", error);
    return [];
  }

  const rows = (data ?? []) as ClientPortalLead[];
  if (preferredLeadId) {
    const hit = rows.find((r) => String(r.id) === String(preferredLeadId));
    if (hit) return [hit, ...rows.filter((r) => String(r.id) !== String(preferredLeadId))];
  }
  return rows;
}

export async function assertLeadAccessForUser(
  user: User,
  leadId: string
): Promise<ClientPortalLead | null> {
  const leads = await findLeadsForPortalUser(user, leadId);
  const row = leads.find((l) => String(l.id) === String(leadId));
  return row ?? null;
}
