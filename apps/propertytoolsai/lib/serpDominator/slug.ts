import { normalizeKeywordForDedupe } from "@/lib/keywordDiscovery/normalize";

export function keywordToSlug(keyword: string): string {
  const n = normalizeKeywordForDedupe(keyword);
  return n
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

export function buildSerpHubPath(keywordSlug: string, pageType: string): string {
  return `/serp-hub/${keywordSlug}/${pageType}`;
}
