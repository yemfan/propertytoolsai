import { supabaseServer } from "@/lib/supabaseServer";
import type { KeywordOpportunity } from "./types";

export async function fetchOurKeywordCatalogNormalized(): Promise<Set<string>> {
  const { data, error } = await supabaseServer.from("seo_keyword_candidates").select("normalized_keyword").limit(50000);
  if (error) {
    console.warn("[competitorIntel] fetchOurKeywordCatalogNormalized", error.message);
    return new Set();
  }
  return new Set((data ?? []).map((r) => r.normalized_keyword as string).filter(Boolean));
}

export async function insertCompetitorRun(input: {
  domain: string;
  config: Record<string, unknown>;
}): Promise<{ id: string | null; error?: string }> {
  const { data, error } = await supabaseServer
    .from("seo_competitor_analysis_runs")
    .insert({
      domain: input.domain,
      config: input.config,
    })
    .select("id")
    .single();

  if (error) return { id: null, error: error.message };
  return { id: data?.id ?? null };
}

export async function finalizeCompetitorRun(
  runId: string,
  stats: { pages_crawled: number; keywords_extracted: number; opportunities_created: number; error?: string | null }
): Promise<void> {
  await supabaseServer
    .from("seo_competitor_analysis_runs")
    .update({
      pages_crawled: stats.pages_crawled,
      keywords_extracted: stats.keywords_extracted,
      opportunities_created: stats.opportunities_created,
      error: stats.error ?? null,
    })
    .eq("id", runId);
}

export async function upsertCompetitorPage(input: {
  run_id: string;
  url: string;
  title: string | null;
  headings: string[];
  text_excerpt: string;
  text_chars: number;
  http_status: number | null;
  fetch_error: string | null;
}): Promise<string | null> {
  const { data, error } = await supabaseServer
    .from("seo_competitor_pages")
    .upsert(
      {
        run_id: input.run_id,
        url: input.url,
        title: input.title,
        headings: input.headings,
        text_excerpt: input.text_excerpt,
        text_chars: input.text_chars,
        http_status: input.http_status,
        fetch_error: input.fetch_error,
      },
      { onConflict: "run_id,url" }
    )
    .select("id")
    .maybeSingle();

  if (!error && data?.id) return data.id as string;

  const { data: row } = await supabaseServer
    .from("seo_competitor_pages")
    .select("id")
    .eq("run_id", input.run_id)
    .eq("url", input.url)
    .maybeSingle();

  return (row?.id as string) ?? null;
}

export async function insertCompetitorKeywordsBatch(
  rows: {
    run_id: string;
    page_id: string | null;
    normalized_keyword: string;
    display_keyword: string;
    intent: string | null;
    extraction_score: number;
    source_page_url: string;
  }[]
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabaseServer.from("seo_competitor_keywords").insert(rows);
  if (error) console.warn("[competitorIntel] insertCompetitorKeywordsBatch", error.message);
}

export async function insertOpportunityRows(runId: string, rows: KeywordOpportunity[]): Promise<void> {
  for (const chunk of chunkArray(rows, 100)) {
    const payload = chunk.map((r) => ({
      run_id: runId,
      normalized_keyword: r.normalized_keyword,
      display_keyword: r.display_keyword,
      opportunity_score: r.opportunity_score,
      gap_type: r.gap_type,
      gap_detail: r.gap_detail,
      cluster_slug: r.cluster_slug,
      suggested_guide_path: r.suggested_guide_path,
      competitor_refs: r.competitor_refs,
      rank: r.rank,
    }));
    await supabaseServer.from("seo_keyword_opportunities").upsert(payload, {
      onConflict: "run_id,normalized_keyword",
    });
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function listOpportunitiesForRun(runId: string, limit = 200): Promise<KeywordOpportunity[]> {
  const { data, error } = await supabaseServer
    .from("seo_keyword_opportunities")
    .select("*")
    .eq("run_id", runId)
    .order("rank", { ascending: true })
    .limit(limit);

  if (error || !data) return [];
  return data.map((r) => ({
    normalized_keyword: r.normalized_keyword as string,
    display_keyword: r.display_keyword as string,
    opportunity_score: Number(r.opportunity_score),
    gap_type: r.gap_type as string,
    gap_detail: (r.gap_detail as string) ?? null,
    cluster_slug: (r.cluster_slug as string) ?? null,
    suggested_guide_path: (r.suggested_guide_path as string) ?? null,
    competitor_refs: (r.competitor_refs as KeywordOpportunity["competitor_refs"]) ?? [],
    rank: Number(r.rank),
  }));
}
