import type { SerpInternalLink, SerpPageType } from "./types";
import { SERP_PAGE_TYPES } from "./types";
import { buildSerpHubPath } from "./slug";

const LABELS: Record<SerpPageType, string> = {
  tool: "Calculator & tool angle",
  landing: "Landing / conversion",
  blog: "Guide & blog",
  comparison: "Comparison",
  faq: "FAQ hub",
};

/**
 * Full cluster: every page links to all sibling URLs (mesh) for topical authority.
 */
export function buildSerpClusterInternalLinks(
  keywordSlug: string,
  siteOrigin: string
): SerpInternalLink[] {
  const base = siteOrigin.replace(/\/+$/, "");
  return SERP_PAGE_TYPES.map((pageType) => ({
    pageType,
    href: `${base}${buildSerpHubPath(keywordSlug, pageType)}`,
    label: LABELS[pageType],
  }));
}

/** Per-page list: all cluster links except optional exclude self for “related” UI */
export function linksForPage(
  all: SerpInternalLink[],
  currentType: SerpPageType,
  options?: { excludeSelf?: boolean }
): SerpInternalLink[] {
  if (!options?.excludeSelf) return all;
  return all.filter((l) => l.pageType !== currentType);
}
