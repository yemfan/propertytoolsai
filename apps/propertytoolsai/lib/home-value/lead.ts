import { supabaseAdmin } from "@/lib/supabase/admin";

type CreateLeadInput = {
  name: string;
  email: string;
  phone?: string;
  address: string;
  estimateValue: number;
  confidence: string;
  sessionId: string;
  zip?: string;
  city?: string;
  /** Owning agent (bigint id from public.agents). Required — contacts.agent_id is NOT NULL. */
  agentId: number;
};

/**
 * Persist the home-value capture as a row in public.contacts. Pre-Phase-2c
 * this targeted public.leads, which is now a view consolidated into
 * contacts and not insertable — every unlock-report POST was 500'ing
 * with "relation leads is not insertable" which the API caught and
 * served back as the generic "Failed to unlock report" banner.
 *
 * The caller (unlock-report route) now picks the owning agent up front
 * via pickAgentForHomeValueLead so we have an agent_id at insert time.
 */
export async function createLeadFromHomeValue(input: CreateLeadInput) {
  const engagementScore =
    input.confidence === "high" ? 75 : input.confidence === "medium" ? 60 : 45;

  const { data, error } = await supabaseAdmin
    .from("contacts")
    .insert({
      agent_id: input.agentId,
      name: input.name,
      email: input.email,
      phone: input.phone || null,
      address: input.address,
      property_address: input.address,
      full_address: input.address,
      city: input.city || null,
      zip_code: input.zip || null,
      source: "home_value",
      lead_type: "seller",
      intent: "home_valuation",
      lifecycle_stage: "lead",
      lead_status: "new",
      engagement_score: engagementScore,
      estimated_home_value: input.estimateValue,
      notes: `Home value report unlocked. Session: ${input.sessionId}. Estimated value: $${input.estimateValue.toLocaleString()}`,
      source_session_id: input.sessionId,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data;
}
