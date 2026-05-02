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
};

/**
 * Persist the home-value capture as a row in public.contacts with
 * `agent_id = NULL` so it lands in the shared lead queue
 * (/dashboard/lead-queue), where any agent can claim it.
 *
 * Earlier we pre-assigned an agent here to satisfy the NOT NULL
 * constraint, which had the side effect of bypassing the queue
 * entirely — every home-value lead landed already-owned. The
 * 20260605 migration drops NOT NULL on agent_id; this writer now
 * passes null and lets the queue do its job.
 */
export async function createLeadFromHomeValue(input: CreateLeadInput) {
  const engagementScore =
    input.confidence === "high" ? 75 : input.confidence === "medium" ? 60 : 45;

  const { data, error } = await supabaseAdmin
    .from("contacts")
    .insert({
      // agent_id intentionally null — queue surfaces unowned leads.
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
