import { supabaseAdmin } from "@/lib/supabase/admin";

export async function createBuyerLeadFromAffordability(input: {
  name: string;
  email: string;
  phone?: string;
  zip?: string;
  maxHomePrice: number;
  sessionId: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("leads")
    .insert({
      name: input.name,
      email: input.email,
      phone: input.phone || null,
      zip: input.zip || null,
      source: "affordability_report",
      source_detail: "propertytoolsai",
      lead_type: "buyer",
      intent: "buyer_affordability",
      status: "new",
      engagement_score: 70,
      notes: `Affordability report unlocked. Session: ${input.sessionId}. Max home price: ${input.maxHomePrice}`,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
