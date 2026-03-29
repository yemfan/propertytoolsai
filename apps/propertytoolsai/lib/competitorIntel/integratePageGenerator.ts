import { runKeywordDiscovery } from "@/lib/keywordDiscovery/pipeline";
import { generatePagesFromKeywordCluster } from "@/lib/keywordDiscovery/integrateCluster";
import { listOpportunitiesForRun } from "./db";

/**
 * Feed top competitor gaps into the keyword discovery pipeline as seeds (persists to `seo_keyword_candidates`).
 */
export async function feedOpportunitiesToKeywordDiscovery(
  runId: string,
  options?: { topN?: number }
): Promise<Awaited<ReturnType<typeof runKeywordDiscovery>>> {
  const topN = Math.min(options?.topN ?? 15, 50);
  const opps = await listOpportunitiesForRun(runId, topN);
  const seeds = opps.map((o) => o.display_keyword).filter(Boolean);
  if (seeds.length === 0) {
    return {
      runId: null,
      seeds: [],
      candidates: [],
      stats: { rawGenerated: 0, afterDedupe: 0, inserted: 0, updated: 0 },
    };
  }

  return runKeywordDiscovery({
    seeds,
    minPerSeed: 20,
    persist: true,
  });
}

/**
 * For each opportunity with a resolved cluster, optionally materialize guide pages (first N metros).
 */
export async function materializeGuidesFromOpportunities(
  runId: string,
  options?: { topClusters?: number; locationLimit?: number; force?: boolean }
): Promise<{ clusterSlug: string; generated: Awaited<ReturnType<typeof generatePagesFromKeywordCluster>> }[]> {
  const opps = await listOpportunitiesForRun(runId, 100);
  const seen = new Set<string>();
  const maxClusters = options?.topClusters ?? 5;
  const out: { clusterSlug: string; generated: Awaited<ReturnType<typeof generatePagesFromKeywordCluster>> }[] = [];

  for (const o of opps) {
    if (!o.cluster_slug || seen.has(o.cluster_slug)) continue;
    seen.add(o.cluster_slug);

    const generated = await generatePagesFromKeywordCluster({
      clusterSlug: o.cluster_slug,
      locationLimit: options?.locationLimit ?? 3,
      force: Boolean(options?.force),
    });
    out.push({ clusterSlug: o.cluster_slug, generated });
    if (out.length >= maxClusters) break;
  }

  return out;
}
