import { supabaseServerClient } from "@/lib/supabaseServerClient";

export type SupportStaffContext = {
  userId: string;
  email: string | null;
  kind: "admin" | "agent";
  /** `agents.id` when kind is agent */
  agentId?: string;
};

/**
 * Support inbox: platform `admin` **or** user with an `agents` row (dashboard agents).
 */
export async function getSupportStaffContext(): Promise<SupportStaffContext | null> {
  const supabase = supabaseServerClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) return null;

  const { data: profile } = await supabase
    .from("leadsmart_users")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  const role = String((profile as { role?: string } | null)?.role ?? "").toLowerCase();
  if (role === "admin") {
    return { userId: user.id, email: user.email ?? null, kind: "admin" };
  }

  const { data: agent } = await supabase
    .from("agents")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (agent && (agent as { id?: unknown }).id != null) {
    return {
      userId: user.id,
      email: user.email ?? null,
      kind: "agent",
      agentId: String((agent as { id: unknown }).id),
    };
  }

  return null;
}
