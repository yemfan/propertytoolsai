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
      address: input.address,
      city: input.city || null,
      zip: input.zip || null,
      source: "home_value_estimate",
      source_detail: "propertytoolsai",
      lead_type: "seller",
      intent: "home_valuation",
      status: "new",
      engagement_score: engagementScore,
      notes: `Home value report unlocked. Session: ${input.sessionId}. Estimated value: ${input.estimateValue}`,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
