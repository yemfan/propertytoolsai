import { supabaseAdmin } from "@/lib/supabase/admin";
import { scheduleLeadScoreRefresh } from "@/lib/lead-scoring/service";

export type ListingLeadInput = {
  name: string;
  email: string;
  phone?: string;
  listingId: string;
  listingAddress: string;
  city?: string;
  zip?: string;
  price?: number;
  actionType: "ask_agent" | "contact_agent" | "schedule_tour";
  requestedTime?: string;
  notes?: string;
};

type AgentProfile = {
  agent_id: string;
  full_name: string;
  email?: string | null;
  service_zip_codes?: string[] | null;
  service_cities?: string[] | null;
  is_active: boolean;
  max_active_leads: number;
  current_active_leads: number;
  priority_weight: number;
};

export function scoreListingLead(input: ListingLeadInput): number {
  let score = 60;
  if (input.actionType === "schedule_tour") score += 25;
  if (input.actionType === "contact_agent") score += 15;
  if (input.phone) score += 5;
  if ((input.price ?? 0) >= 800000) score += 10;
  return Math.min(score, 100);
}

export async function createListingLead(input: ListingLeadInput) {
  const engagementScore = scoreListingLead(input);

  const { data: lead, error } = await supabaseAdmin
    .from("leads")
    .insert({
      name: input.name,
      email: input.email,
      phone: input.phone || null,
      address: input.listingAddress,
      city: input.city || null,
      zip: input.zip || null,
      source: "listing_inquiry",
      source_detail: input.actionType,
      lead_type: "buyer",
      intent: input.actionType === "schedule_tour" ? "tour_request" : "listing_inquiry",
      status: "new",
      engagement_score: engagementScore,
      conversation_status: "automated",
      notes: `${input.actionType} for listing ${input.listingId}${input.requestedTime ? ` | requested time: ${input.requestedTime}` : ""}${input.notes ? ` | notes: ${input.notes}` : ""}`,
    })
    .select()
    .single();

  if (error) throw error;

  const { error: activityError } = await supabaseAdmin.from("lead_activity_events").insert({
    lead_id: lead.id,
    event_type: "lead_created",
    title: "Listing lead created",
    description: `${input.actionType} submitted for ${input.listingAddress}`,
    source: "listing_ui",
    actor_type: "customer",
    actor_name: input.name,
    metadata: {
      listingId: input.listingId,
      listingAddress: input.listingAddress,
      actionType: input.actionType,
      requestedTime: input.requestedTime || null,
      price: input.price || null,
      notes: input.notes || null,
    },
  });

  if (activityError) throw activityError;

  scheduleLeadScoreRefresh(String(lead.id));

  return lead;
}

export async function autoAssignListingLead(leadId: string, zip?: string, city?: string) {
  const { data: agents, error } = await supabaseAdmin
    .from("agent_profiles")
    .select("*")
    .eq("is_active", true);

  if (error) throw error;
  const rows = (agents ?? []) as AgentProfile[];
  if (!rows.length) return null;

  const normalizedZip = zip?.trim();
  const normalizedCity = city?.trim().toLowerCase();

  const territoryMatches = rows.filter((agent) => {
    const zipMatch =
      normalizedZip &&
      Array.isArray(agent.service_zip_codes) &&
      agent.service_zip_codes.includes(normalizedZip);
    const cityMatch =
      normalizedCity &&
      Array.isArray(agent.service_cities) &&
      agent.service_cities.some((c) => c.toLowerCase() === normalizedCity);
    return zipMatch || cityMatch;
  });

  const candidatePool = territoryMatches.length ? territoryMatches : rows;
  const selected = [...candidatePool]
    .filter((agent) => agent.current_active_leads < agent.max_active_leads)
    .sort((a, b) => {
      const aScore = a.max_active_leads - a.current_active_leads + (a.priority_weight ?? 1) * 10;
      const bScore = b.max_active_leads - b.current_active_leads + (b.priority_weight ?? 1) * 10;
      return bScore - aScore;
    })[0];

  if (!selected) return null;

  const { error: leadUpdateError } = await supabaseAdmin
    .from("leads")
    .update({
      assigned_agent_id: selected.agent_id,
      status: "assigned",
    })
    .eq("id", leadId);

  if (leadUpdateError) throw leadUpdateError;

  const { error: agentUpdateError } = await supabaseAdmin
    .from("agent_profiles")
    .update({
      current_active_leads: selected.current_active_leads + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("agent_id", selected.agent_id);

  if (agentUpdateError) throw agentUpdateError;

  const { error: notifError } = await supabaseAdmin.from("agent_notifications").insert({
    agent_id: selected.agent_id,
    lead_id: leadId,
    type: "new_listing_lead",
    title: "New Listing Lead Assigned",
    message: `A buyer inquiry has been assigned to you.${city || zip ? ` Area: ${city || zip}.` : ""}`,
    action_url: `/dashboard/agent/leads/${leadId}`,
    status: "unread",
  });

  if (notifError) throw notifError;

  const { error: assignActivityError } = await supabaseAdmin.from("lead_activity_events").insert({
    lead_id: leadId,
    event_type: "lead_assigned",
    title: "Listing lead assigned",
    description: `Assigned to ${selected.full_name}`,
    source: "assignment_engine",
    actor_type: "system",
    actor_id: selected.agent_id,
    actor_name: selected.full_name,
    metadata: {},
  });

  if (assignActivityError) throw assignActivityError;

  return {
    agentId: selected.agent_id,
    fullName: selected.full_name,
    email: selected.email ?? null,
  };
}
