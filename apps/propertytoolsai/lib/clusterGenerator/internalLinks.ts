import { getClusterTopicBySlug } from "./topics";
import type { ClusterInternalLink } from "./types";
import { buildGuidePath } from "./slug";

/**
 * Builds internal links to sibling topics in the same metro (cluster SEO).
 */
export function buildInternalLinksForPage(
  topicSlug: string,
  locationSlug: string,
  maxLinks = 6
): ClusterInternalLink[] {
  const topic = getClusterTopicBySlug(topicSlug);
  if (!topic) return [];

  const out: ClusterInternalLink[] = [];
  const seen = new Set<string>([topicSlug]);

  for (const related of topic.relatedSlugs) {
    if (out.length >= maxLinks) break;
    if (seen.has(related)) continue;
    const rt = getClusterTopicBySlug(related);
    if (!rt) continue;
    seen.add(related);
    out.push({
      topicSlug: related,
      anchor: rt.name,
      href: buildGuidePath(related, locationSlug),
    });
  }

  return out;
}
