import { supabaseAdmin } from "@/lib/supabase/admin";

type AssignLeadInput = {
  leadId: string | number;
  zip?: string;
  city?: string;
};

/**
 * Best-effort auto-assignment: pick an active agent that accepts new leads.
 * Returns null (no assignment) if no agents qualify — caller continues normally.
 */
export async function autoAssignLeadToAgent(input: AssignLeadInput) {
  try {
    const { data: agents, error } = await supabaseAdmin
      .from("agents")
      .select("id, auth_user_id, service_areas, accepts_new_leads")
      .eq("accepts_new_leads", true);

    if (error || !agents?.length) return null;

    // Try to find an agent whose service_areas overlap with lead zip/city
    const normalizedZip = input.zip?.trim();
    const normalizedCity = input.city?.trim().toLowerCase();

    let selected = agents.find((a) => {
      const areas: string[] = Array.isArray(a.service_areas) ? a.service_areas : [];
      return areas.some(
        (area) =>
          area === normalizedZip ||
          area.toLowerCase() === normalizedCity
      );
    });

    // Fallback: pick the first active agent
    if (!selected) selected = agents[0];

    // Look up user_profiles for name/email
    let fullName: string | null = null;
    let email: string | null = null;

    if (selected.auth_user_id) {
      const { data: profile } = await supabaseAdmin
        .from("user_profiles")
        .select("full_name, email")
        .eq("user_id", selected.auth_user_id)
        .single();

      fullName = profile?.full_name ?? null;
      email = profile?.email ?? null;
    }

    // Assign the lead
    await supabaseAdmin
      .from("leads")
      .update({
        assigned_agent_id: selected.auth_user_id,
        status: "assigned",
      })
      .eq("id", input.leadId);

    return {
      agentId: selected.auth_user_id ?? String(selected.id),
      fullName,
      email,
    };
  } catch (err) {
    // Assignment is best-effort — log but don't block report unlock
    console.error("autoAssignLeadToAgent failed (non-fatal):", err);
    return null;
  }
}
