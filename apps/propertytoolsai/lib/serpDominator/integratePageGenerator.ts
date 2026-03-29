import { runKeywordDiscovery } from "@/lib/keywordDiscovery/pipeline";
import { runSerpDominatorCampaign } from "./pipeline";

/**
 * After keyword discovery, promote top seeds into full 5-page SERP clusters (optional batch).
 */
export async function expandSeedsToSerpClusters(seeds: string[], options?: { clusterHint?: string }) {
  const results: Awaited<ReturnType<typeof runSerpDominatorCampaign>>[] = [];
  for (const seed of seeds.slice(0, 5)) {
    results.push(await runSerpDominatorCampaign(seed, { clusterHint: options?.clusterHint }));
  }
  return results;
}

/**
 * One-shot: run keyword discovery for a phrase, then SERP dominator for the same phrase.
 */
export async function runDiscoveryThenSerp(seedKeyword: string) {
  const disc = await runKeywordDiscovery({ seeds: [seedKeyword], minPerSeed: 25, persist: true });
  const serp = await runSerpDominatorCampaign(seedKeyword);
  return { discovery: disc, serp };
}
