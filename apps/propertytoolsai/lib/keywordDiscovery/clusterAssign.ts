import { CLUSTER_TOPICS, getClusterTopicBySlug } from "@/lib/clusterGenerator/topics";

/**
 * Resolves cluster slug: prefer validated AI hint, else best overlap with topic keyword lists.
 */
export function assignClusterSlug(phrase: string, clusterHint?: string | null): string | null {
  if (clusterHint) {
    const t = getClusterTopicBySlug(clusterHint.trim());
    if (t) return t.slug;
  }

  const normalized = phrase.toLowerCase().trim();
  let best: { slug: string; score: number } | null = null;

  for (const topic of CLUSTER_TOPICS) {
    let score = 0;
    for (const kw of topic.keywords) {
      const k = kw.toLowerCase();
      if (normalized.includes(k)) score += 3;
      const parts = k.split(/\s+/).filter((w) => w.length > 3);
      for (const w of parts) {
        if (normalized.includes(w)) score += 1;
      }
    }
    const nameTokens = topic.name
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 4);
    for (const w of nameTokens) {
      if (normalized.includes(w)) score += 2;
    }
    if (score > (best?.score ?? 0)) best = { slug: topic.slug, score };
  }

  return best && best.score >= 2 ? best.slug : null;
}
