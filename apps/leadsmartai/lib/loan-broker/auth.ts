import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { supabaseServer } from "@/lib/supabaseServer";

export type BrokerContext = {
  userId: string;
  brokerId: string;
  email: string | null;
};

/**
 * Get the current broker context from the session.
 * Throws if not authenticated or not a broker.
 */
export async function getCurrentBrokerContext(): Promise<BrokerContext> {
  const supabase = supabaseServerClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw new Error("Not authenticated");
  if (!userData.user) throw new Error("Not authenticated");

  const userId = userData.user.id;

  // Check leadsmart_users role
  const { data: lsUser } = await supabaseServer
    .from("leadsmart_users")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  const role = (lsUser as any)?.role;
  if (role !== "broker" && role !== "admin" && role !== "support") {
    throw new Error("Not a loan broker");
  }

  return {
    userId,
    brokerId: userId, // Use auth user ID as broker ID
    email: userData.user.email ?? null,
  };
}
