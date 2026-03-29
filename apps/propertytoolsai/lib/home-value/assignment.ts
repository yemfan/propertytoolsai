import { supabaseAdmin } from "@/lib/supabase/admin";

type AssignLeadInput = {
  leadId: string;
  zip?: string;
  city?: string;
};

type AgentProfile = {
  agent_id: string;
  full_name: string;
  email?: string | null;
  service_zip_codes?: string[] | null;
  service_cities?: string[] | null;
  is_active: boolean;
  max_active_leads: number;
  current_active_leads: number;
  priority_weight: number;
};

export async function autoAssignLeadToAgent(input: AssignLeadInput) {
  const { data: agents, error } = await supabaseAdmin
    .from("agent_profiles")
    .select("*")
    .eq("is_active", true);

  if (error) throw error;

  const rows = (agents ?? []) as AgentProfile[];
  if (!rows.length) return null;

  const normalizedZip = input.zip?.trim();
  const normalizedCity = input.city?.trim().toLowerCase();

  const territoryMatches = rows.filter((agent) => {
    const zipMatch =
      normalizedZip &&
      Array.isArray(agent.service_zip_codes) &&
      agent.service_zip_codes.includes(normalizedZip);

    const cityMatch =
      normalizedCity &&
      Array.isArray(agent.service_cities) &&
      agent.service_cities.some((c) => c.toLowerCase() === normalizedCity);

    return zipMatch || cityMatch;
  });

  const candidatePool = territoryMatches.length ? territoryMatches : rows;

  const scored = candidatePool
    .filter((agent) => agent.current_active_leads < agent.max_active_leads)
    .map((agent) => {
      const capacityScore = agent.max_active_leads - agent.current_active_leads;

      return {
        ...agent,
        assignmentScore: capacityScore + (agent.priority_weight ?? 1) * 10,
      };
    })
    .sort((a, b) => b.assignmentScore - a.assignmentScore);

  const selected = scored[0];
  if (!selected) return null;

  const { error: updateLeadError } = await supabaseAdmin
    .from("leads")
    .update({
      assigned_agent_id: selected.agent_id,
      status: "assigned",
    })
    .eq("id", input.leadId);

  if (updateLeadError) throw updateLeadError;

  const { error: updateAgentError } = await supabaseAdmin
    .from("agent_profiles")
    .update({
      current_active_leads: selected.current_active_leads + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("agent_id", selected.agent_id);

  if (updateAgentError) throw updateAgentError;

  return {
    agentId: selected.agent_id,
    fullName: selected.full_name,
    email: selected.email ?? null,
  };
}
