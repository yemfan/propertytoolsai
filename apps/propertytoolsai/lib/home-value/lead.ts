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

export async function createLeadFromHomeValue(input: CreateLeadInput) {
  const engagementScore =
    input.confidence === "high"
      ? 75
      : input.confidence === "medium"
        ? 60
        : 45;

  const { data, error } = await supabaseAdmin
    .from("leads")
    .insert({
      name: input.name,
      email: input.email,
      phone: input.phone || null,
      property_address: input.address,
      full_address: input.address,
      city: input.city || null,
      zip_code: input.zip || null,
      source: "home_value_estimate",
      lead_type: "seller",
      intent: "home_valuation",
      status: "new",
      engagement_score: engagementScore,
      estimated_home_value: input.estimateValue,
      notes: `Home value report unlocked. Session: ${input.sessionId}. Estimated value: $${input.estimateValue.toLocaleString()}`,
      source_session_id: input.sessionId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
