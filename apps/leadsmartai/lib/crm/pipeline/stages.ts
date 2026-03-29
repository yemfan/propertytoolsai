import { supabaseServer } from "@/lib/supabaseServer";
import type { PipelineStageRow } from "./types";

const DEFAULT_STAGES: Array<{ slug: string; name: string; position: number; color: string | null }> = [
  { slug: "new_lead", name: "New lead", position: 0, color: "#64748b" },
  { slug: "contacted", name: "Contacted", position: 1, color: "#0ea5e9" },
  { slug: "showing", name: "Showing / tour", position: 2, color: "#8b5cf6" },
  { slug: "offer", name: "Offer & negotiation", position: 3, color: "#f59e0b" },
  { slug: "contract", name: "Under contract", position: 4, color: "#10b981" },
  { slug: "closed_won", name: "Closed — won", position: 5, color: "#059669" },
  { slug: "nurture", name: "Long-term nurture", position: 6, color: "#94a3b8" },
];

export async function ensureDefaultPipelineStages(agentId: string): Promise<void> {
  const { count, error: cErr } = await supabaseServer
    .from("crm_pipeline_stages")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agentId as any);

  if (cErr) throw new Error(cErr.message);
  if ((count ?? 0) > 0) return;

  const rows = DEFAULT_STAGES.map((s) => ({
    agent_id: agentId as any,
    slug: s.slug,
    name: s.name,
    position: s.position,
    color: s.color,
  }));

  const { error } = await supabaseServer.from("crm_pipeline_stages").insert(rows as any);
  if (error) throw new Error(error.message);
}

export async function listPipelineStages(agentId: string): Promise<PipelineStageRow[]> {
  await ensureDefaultPipelineStages(agentId);
  const { data, error } = await supabaseServer
    .from("crm_pipeline_stages")
    .select("id,agent_id,name,slug,position,color,created_at")
    .eq("agent_id", agentId as any)
    .order("position", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PipelineStageRow[];
}

export async function getStageBySlug(agentId: string, slug: string): Promise<PipelineStageRow | null> {
  const { data, error } = await supabaseServer
    .from("crm_pipeline_stages")
    .select("id,agent_id,name,slug,position,color,created_at")
    .eq("agent_id", agentId as any)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as PipelineStageRow | null) ?? null;
}
