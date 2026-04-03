import { supabaseServer } from "@/lib/supabaseServer";

/** Same as propertytoolsai — shared Supabase DB. */
export async function getStripeCustomerIdForUser(userId: string): Promise<string | null> {
  const { data: agent } = await supabaseServer
    .from("agents")
    .select("stripe_customer_id")
    .eq("auth_user_id", userId)
    .maybeSingle();

  const fromAgent = (agent as { stripe_customer_id?: string } | null)?.stripe_customer_id;
  if (fromAgent && String(fromAgent).trim()) return String(fromAgent).trim();

  const { data: ls } = await supabaseServer
    .from("leadsmart_users")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  const fromLs = (ls as { stripe_customer_id?: string } | null)?.stripe_customer_id;
  if (fromLs && String(fromLs).trim()) return String(fromLs).trim();

  const { data: pt } = await supabaseServer
    .from("propertytools_users")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  const fromPt = (pt as { stripe_customer_id?: string } | null)?.stripe_customer_id;
  if (fromPt && String(fromPt).trim()) return String(fromPt).trim();

  return null;
}
