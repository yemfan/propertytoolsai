import { generateClusterPage } from "@/lib/clusterGenerator/pipeline";
import { PROGRAMMATIC_SEO_LOCATIONS } from "@/lib/programmaticSeo/locations";
import { listKeywordCandidatesSorted } from "./db";
import type { KeywordRowDb } from "./db";

export type PageGeneratorFeedItem = {
  keyword: KeywordRowDb;
  /** Suggested programmatic URL for guides */
  suggestedGuidePath: string;
};

/**
 * Top keywords for a cluster (sorted by score in DB), for prioritizing guide generation.
 */
export async function getKeywordsForCluster(clusterSlug: string, limit = 50): Promise<KeywordRowDb[]> {
  return listKeywordCandidatesSorted({ clusterSlug, limit });
}

/**
 * Build feed: high-scoring keywords + suggested `/guides/{cluster}/{location}` paths across metros.
 */
export async function buildClusterPageGeneratorFeed(options: {
  clusterSlug: string;
  keywordLimit?: number;
  maxLocations?: number;
}): Promise<PageGeneratorFeedItem[]> {
  const kwLimit = options.keywordLimit ?? 30;
  const maxLoc = Math.min(options.maxLocations ?? 5, PROGRAMMATIC_SEO_LOCATIONS.length);

  const keywords = await getKeywordsForCluster(options.clusterSlug, kwLimit);
  const locs = PROGRAMMATIC_SEO_LOCATIONS.slice(0, maxLoc);

  const out: PageGeneratorFeedItem[] = [];
  for (const k of keywords.slice(0, 15)) {
    for (const loc of locs) {
      out.push({
        keyword: k,
        suggestedGuidePath: `/guides/${options.clusterSlug}/${loc.slug}`,
      });
    }
  }
  return out;
}

/**
 * Materialize cluster guide pages for a slug across the first N metros (cluster generator).
 * Keywords inform *priority* in UI/reporting; URLs are always topic × location.
 */
export async function generatePagesFromKeywordCluster(input: {
  clusterSlug: string;
  locationLimit?: number;
  force?: boolean;
}): Promise<{ results: Awaited<ReturnType<typeof generateClusterPage>>[] }> {
  const locs = PROGRAMMATIC_SEO_LOCATIONS.slice(0, Math.min(input.locationLimit ?? 3, 20));
  const results: Awaited<ReturnType<typeof generateClusterPage>>[] = [];
  for (const loc of locs) {
    results.push(
      await generateClusterPage(input.clusterSlug, loc.slug, {
        force: Boolean(input.force),
      })
    );
  }
  return { results };
}
