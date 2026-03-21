import { supabaseServer } from "@/lib/supabaseServer";

export type StoredMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
  source?: string;
};

export async function getOrCreateConversation(leadId: string, agentId: string) {
  const { data: existing } = await supabaseServer
    .from("lead_conversations")
    .select("id,messages,preferences,updated_at")
    .eq("lead_id", leadId)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabaseServer
    .from("lead_conversations")
    .upsert(
      {
        lead_id: leadId as any,
        agent_id: agentId,
        messages: [],
        preferences: {},
      } as any,
      { onConflict: "lead_id" }
    )
    .select("id,messages,preferences,updated_at")
    .single();

  if (error) throw error;
  return data;
}

export async function appendMessages(
  leadId: string,
  agentId: string,
  additions: StoredMessage[]
) {
  const row = await getOrCreateConversation(leadId, agentId);
  const prev = Array.isArray((row as any).messages) ? ([...(row as any).messages] as StoredMessage[]) : [];
  const next = [...prev, ...additions];
  const { error } = await supabaseServer
    .from("lead_conversations")
    .update({
      messages: next as any,
      updated_at: new Date().toISOString(),
    } as any)
    .eq("lead_id", leadId)
    .eq("agent_id", agentId);
  if (error) throw error;
  return next;
}

export async function updatePreferences(
  leadId: string,
  agentId: string,
  patch: Record<string, unknown>
) {
  const row = await getOrCreateConversation(leadId, agentId);
  const prev = ((row as any).preferences && typeof (row as any).preferences === "object")
    ? { ...(row as any).preferences }
    : {};
  const next = { ...prev, ...patch };
  const { error } = await supabaseServer
    .from("lead_conversations")
    .update({
      preferences: next as any,
      updated_at: new Date().toISOString(),
    } as any)
    .eq("lead_id", leadId)
    .eq("agent_id", agentId);
  if (error) throw error;
  return next;
}
