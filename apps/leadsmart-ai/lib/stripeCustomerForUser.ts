import { supabaseServer } from "@/lib/supabaseServer";

/** Same as property-tools — shared Supabase DB. */
export async function getStripeCustomerIdForUser(userId: string): Promise<string | null> {
  const { data: agent } = await supabaseServer
    .from("agents")
    .select("stripe_customer_id")
    .eq("auth_user_id", userId)
    .maybeSingle();

  const fromAgent = (agent as { stripe_customer_id?: string } | null)?.stripe_customer_id;
  if (fromAgent && String(fromAgent).trim()) return String(fromAgent).trim();

  const { data: profile } = await supabaseServer
    .from("user_profiles")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  const fromProfile = (profile as { stripe_customer_id?: string } | null)?.stripe_customer_id;
  if (fromProfile && String(fromProfile).trim()) return String(fromProfile).trim();

  return null;
}
