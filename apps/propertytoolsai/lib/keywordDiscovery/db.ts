import { supabaseServer } from "@/lib/supabaseServer";
import type { KeywordCandidate, KeywordIntent } from "./types";

export async function insertDiscoveryRun(input: {
  seeds: string[];
  minPerSeed: number;
}): Promise<{ id: string | null; error?: string }> {
  const { data, error } = await supabaseServer
    .from("seo_keyword_discovery_runs")
    .insert({
      seeds: input.seeds,
      min_per_seed: input.minPerSeed,
    })
    .select("id")
    .single();

  if (error) return { id: null, error: error.message };
  return { id: data?.id ?? null };
}

export async function finalizeDiscoveryRun(
  runId: string,
  stats: {
    candidatesTotal: number;
    candidatesNew: number;
    candidatesUpdated: number;
    error?: string | null;
  }
): Promise<void> {
  await supabaseServer
    .from("seo_keyword_discovery_runs")
    .update({
      candidates_total: stats.candidatesTotal,
      candidates_new: stats.candidatesNew,
      candidates_updated: stats.candidatesUpdated,
      error: stats.error ?? null,
    })
    .eq("id", runId);
}

/** Current scores for a set of normalized keywords (batched). */
export async function fetchExistingScoresForNormalized(
  normalizedKeys: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (normalizedKeys.length === 0) return map;

  const chunkSize = 200;
  for (let i = 0; i < normalizedKeys.length; i += chunkSize) {
    const chunk = normalizedKeys.slice(i, i + chunkSize);
    const { data, error } = await supabaseServer
      .from("seo_keyword_candidates")
      .select("normalized_keyword, score")
      .in("normalized_keyword", chunk);

    if (error) {
      console.warn("[keywordDiscovery] fetchExistingScoresForNormalized", error.message);
      continue;
    }
    for (const row of data ?? []) {
      map.set(row.normalized_keyword as string, Number(row.score ?? 0));
    }
  }
  return map;
}

export async function upsertKeywordCandidates(
  rows: (KeywordCandidate & { run_id?: string | null })[],
  options?: { existingScores?: Map<string, number> }
): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;
  const existing = options?.existingScores ?? new Map<string, number>();

  for (const r of rows) {
    const prev = existing.get(r.normalized_keyword);
    const row = {
      run_id: r.run_id ?? null,
      normalized_keyword: r.normalized_keyword,
      display_keyword: r.display_keyword,
      intent: r.intent,
      score: r.score,
      cluster_slug: r.cluster_slug,
      source_seed: r.source_seed,
      updated_at: new Date().toISOString(),
    };

    if (prev === undefined) {
      const { error } = await supabaseServer.from("seo_keyword_candidates").insert(row);
      if (!error) {
        inserted++;
        existing.set(r.normalized_keyword, r.score);
      }
    } else if (r.score > prev) {
      const { error } = await supabaseServer
        .from("seo_keyword_candidates")
        .update({
          display_keyword: row.display_keyword,
          intent: row.intent,
          score: row.score,
          cluster_slug: row.cluster_slug,
          source_seed: row.source_seed,
          run_id: row.run_id,
          updated_at: row.updated_at,
        })
        .eq("normalized_keyword", r.normalized_keyword);
      if (!error) {
        updated++;
        existing.set(r.normalized_keyword, r.score);
      }
    }
  }

  return { inserted, updated };
}

export type KeywordRowDb = {
  normalized_keyword: string;
  display_keyword: string;
  intent: KeywordIntent;
  score: number;
  cluster_slug: string | null;
  source_seed: string;
};

/** Sorted keyword list (default: score desc). */
export async function listKeywordCandidatesSorted(options?: {
  clusterSlug?: string | null;
  intent?: KeywordIntent | null;
  limit?: number;
  minScore?: number;
}): Promise<KeywordRowDb[]> {
  const limit = Math.min(options?.limit ?? 500, 10000);
  let q = supabaseServer.from("seo_keyword_candidates").select("*");

  if (options?.clusterSlug) q = q.eq("cluster_slug", options.clusterSlug);
  if (options?.intent) q = q.eq("intent", options.intent);
  if (options?.minScore != null) q = q.gte("score", options.minScore);

  q = q.order("score", { ascending: false }).limit(limit);

  const { data, error } = await q;
  if (error) {
    console.warn("[keywordDiscovery] listKeywordCandidatesSorted", error.message);
    return [];
  }
  return (data ?? []) as unknown as KeywordRowDb[];
}
