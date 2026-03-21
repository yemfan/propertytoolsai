import { supabaseServer } from "@/lib/supabaseServer";

export type ShareableResultInput = {
  brand: "leadsmart" | "propertytools";
  toolSlug: string;
  title: string;
  summary?: string;
  resultJson: Record<string, unknown>;
  refCode?: string | null;
  ttlDays?: number;
};

export async function createShareableResult(input: ShareableResultInput) {
  const expiresAt =
    input.ttlDays && input.ttlDays > 0
      ? new Date(Date.now() + input.ttlDays * 86400000).toISOString()
      : null;

  const { data, error } = await supabaseServer
    .from("shareable_results")
    .insert({
      brand: input.brand,
      tool_slug: input.toolSlug,
      title: input.title,
      summary: input.summary ?? null,
      result_json: input.resultJson,
      ref_code: input.refCode ?? null,
      expires_at: expiresAt,
    } as any)
    .select("id,brand,tool_slug,title,summary,result_json,ref_code,view_count,created_at,expires_at")
    .single();

  if (error) throw error;
  return data as {
    id: string;
    brand: string;
    tool_slug: string;
    title: string;
    summary: string | null;
    result_json: Record<string, unknown>;
    ref_code: string | null;
    view_count: number;
    created_at: string;
    expires_at: string | null;
  };
}

export async function getShareableResultById(id: string) {
  const { data, error } = await supabaseServer
    .from("shareable_results")
    .select("id,brand,tool_slug,title,summary,result_json,ref_code,view_count,created_at,expires_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  const row = data as any;
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return null;
  }
  return row as {
    id: string;
    brand: string;
    tool_slug: string;
    title: string;
    summary: string | null;
    result_json: Record<string, unknown>;
    ref_code: string | null;
    view_count: number;
    created_at: string;
    expires_at: string | null;
  };
}

export async function incrementShareableResultViews(id: string) {
  const existing = await getShareableResultById(id);
  if (!existing) return null;
  const { data, error } = await supabaseServer
    .from("shareable_results")
    .update({ view_count: (existing.view_count ?? 0) + 1 } as any)
    .eq("id", id)
    .select("view_count")
    .single();
  if (error) return existing.view_count;
  return (data as any)?.view_count ?? existing.view_count + 1;
}
