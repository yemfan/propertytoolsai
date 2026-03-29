import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PipelineStageRow } from "@/lib/crm/pipeline/types";
import { MOBILE_PIPELINE_SLUGS, type MobilePipelineSlug } from "@leadsmart/shared";

type StageDef = {
  slug: MobilePipelineSlug;
  /** Match existing CRM defaults when present */
  aliases: string[];
  name: string;
  position: number;
  color: string | null;
};

const STAGE_DEFS: StageDef[] = [
  { slug: "new", aliases: ["new_lead"], name: "New", position: 0, color: "#64748b" },
  { slug: "contacted", aliases: ["contacted"], name: "Contacted", position: 1, color: "#0ea5e9" },
  { slug: "qualified", aliases: ["qualified"], name: "Qualified", position: 2, color: "#6366f1" },
  { slug: "showing", aliases: ["showing"], name: "Showing", position: 3, color: "#8b5cf6" },
  { slug: "offer", aliases: ["offer"], name: "Offer", position: 4, color: "#f59e0b" },
  { slug: "closed", aliases: ["closed_won", "contract"], name: "Closed", position: 5, color: "#059669" },
];

import type { MobilePipelineStageOptionDto } from "@leadsmart/shared";

export type { MobilePipelineSlug, MobilePipelineStageOptionDto };

async function fetchStageBySlug(agentId: string, slug: string): Promise<PipelineStageRow | null> {
  const { data, error } = await supabaseAdmin
    .from("crm_pipeline_stages")
    .select("id,agent_id,name,slug,position,color,created_at")
    .eq("agent_id", agentId as never)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as PipelineStageRow | null) ?? null;
}

/**
 * Ensures each canonical mobile slug resolves to a `crm_pipeline_stages` row (creates missing rows).
 */
export async function listMobilePipelineStages(agentId: string): Promise<MobilePipelineStageOptionDto[]> {
  const out: MobilePipelineStageOptionDto[] = [];

  for (const def of STAGE_DEFS) {
    let row = await fetchStageBySlug(agentId, def.slug);
    if (!row) {
      for (const alt of def.aliases) {
        row = await fetchStageBySlug(agentId, alt);
        if (row) break;
      }
    }

    if (!row) {
      const { data: created, error: insErr } = await supabaseAdmin
        .from("crm_pipeline_stages")
        .insert({
          agent_id: agentId as never,
          slug: def.slug,
          name: def.name,
          position: def.position,
          color: def.color,
        } as never)
        .select("id,agent_id,name,slug,position,color,created_at")
        .single();

      if (insErr) {
        row = await fetchStageBySlug(agentId, def.slug);
        if (!row) throw new Error(insErr.message);
      } else {
        row = created as PipelineStageRow;
      }
    }

    out.push({
      id: row.id,
      mobile_slug: def.slug,
      name: row.name || def.name,
      color: row.color ?? def.color,
      position: def.position,
    });
  }

  return out;
}

export async function resolveMobileSlugToStageId(
  agentId: string,
  slug: string
): Promise<string | null> {
  const s = String(slug || "").trim().toLowerCase();
  if (!MOBILE_PIPELINE_SLUGS.includes(s as MobilePipelineSlug)) return null;

  const stages = await listMobilePipelineStages(agentId);
  const hit = stages.find((x) => x.mobile_slug === s);
  return hit?.id ?? null;
}

/** Map an existing CRM stage row to a canonical mobile slug (for highlighting the picker). */
export function crmSlugToMobileSlug(crmSlug: string | null | undefined): MobilePipelineSlug | null {
  if (!crmSlug) return null;
  const u = crmSlug.toLowerCase();
  for (const def of STAGE_DEFS) {
    if (def.slug === u) return def.slug;
    if (def.aliases.some((a) => a === u)) return def.slug;
  }
  return null;
}
