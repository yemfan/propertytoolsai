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
      .select(
        "id, auth_user_id, service_areas, service_areas_v2, accepts_new_leads",
      )
      .eq("accepts_new_leads", true);

    if (error || !agents?.length) return null;

    // Try to find an agent whose service_areas overlap with lead zip/city.
    // Prefer the structured service_areas_v2 column when populated —
    // city-exact match first, then county-wide coverage by state.
    const normalizedZip = input.zip?.trim();
    const normalizedCity = input.city?.trim().toLowerCase();

    let selected = agents.find((a) => {
      const v2 = Array.isArray((a as any).service_areas_v2)
        ? ((a as any).service_areas_v2 as Array<{
            state?: unknown;
            county?: unknown;
            city?: unknown;
          }>)
        : [];
      for (const e of v2) {
        const city = typeof e.city === "string" ? e.city.toLowerCase() : null;
        if (normalizedCity && city && city === normalizedCity) return true;
        // city === null means "all cities in county" — matches any city
        // within that state (best signal we have without zip→county data).
        // We don't enforce state here because the lead intake may not
        // have parsed it; favoring inclusion over precision for assignment.
        if (e.city === null) return true;
      }
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
