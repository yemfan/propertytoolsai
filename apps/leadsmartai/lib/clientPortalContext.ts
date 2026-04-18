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

  // AI score fields live on `lead_scores`, not on `leads` (avoids 42703 if columns are missing).
  const { data, error } = await supabaseServer
    .from("contacts")
    .select(
      "id,agent_id,name,email,phone,property_address,lead_status,source,report_id,price_min,price_max,search_location,last_activity_at,next_contact_at,created_at"
    )
    .ilike("email", email)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    console.error("findLeadsForPortalUser", error);
    return [];
  }

  type LeadRow = Omit<
    ClientPortalLead,
    "ai_lead_score" | "ai_intent" | "ai_timeline" | "ai_confidence"
  >;
  const rows = (data ?? []) as LeadRow[];

  const leadIds = rows.map((r) => r.id).filter(Boolean);
  const scoreMap: Record<string, Record<string, unknown>> = {};
  if (leadIds.length) {
    const { data: scoreRows, error: scoresErr } = await supabaseServer
      .from("contact_scores")
      .select("contact_id,score,intent,timeline,confidence,updated_at")
      .in("contact_id", leadIds as string[])
      .order("updated_at", { ascending: false })
      .limit(5000);
    if (!scoresErr) {
      for (const row of scoreRows ?? []) {
        const key = String((row as { contact_id?: string }).contact_id ?? "");
        if (!key || scoreMap[key]) continue;
        scoreMap[key] = row as Record<string, unknown>;
      }
    }
  }

  const hydrated: ClientPortalLead[] = rows.map((l) => {
    const s = scoreMap[String(l.id)];
    return {
      ...l,
      ai_lead_score: s ? Number(s.score ?? 0) : null,
      ai_intent: (s?.intent as string) ?? null,
      ai_timeline: (s?.timeline as string) ?? null,
      ai_confidence: s ? Number(s.confidence ?? 0) : null,
    };
  });
  if (preferredLeadId) {
    const hit = hydrated.find((r) => String(r.id) === String(preferredLeadId));
    if (hit) return [hit, ...hydrated.filter((r) => String(r.id) !== String(preferredLeadId))];
  }
  return hydrated;
}

export async function assertLeadAccessForUser(
  user: User,
  leadId: string
): Promise<ClientPortalLead | null> {
  const leads = await findLeadsForPortalUser(user, leadId);
  const row = leads.find((l) => String(l.id) === String(leadId));
  return row ?? null;
}
