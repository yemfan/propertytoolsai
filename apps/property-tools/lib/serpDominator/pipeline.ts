import { assignClusterSlug } from "@/lib/keywordDiscovery/clusterAssign";
import { generateSerpPageForType } from "./aiGenerate";
import { buildSerpClusterInternalLinks } from "./internalLinks";
import { finalizeSerpCampaign, insertSerpCampaign, upsertSerpPage } from "./db";
import { buildSerpHubPath, keywordToSlug } from "./slug";
import { SERP_PAGE_TYPES } from "./types";
import type { SerpPageType } from "./types";

export type SerpCampaignResult = {
  campaignId: string | null;
  keywordSlug: string;
  pages: { pageType: SerpPageType; path: string; ok: boolean }[];
  error?: string;
};

export async function runSerpDominatorCampaign(
  seedKeyword: string,
  options?: { clusterHint?: string; siteOrigin?: string }
): Promise<SerpCampaignResult> {
  const kw = String(seedKeyword ?? "").trim();
  if (!kw) {
    return { campaignId: null, keywordSlug: "", pages: [], error: "empty keyword" };
  }

  const keywordSlug = keywordToSlug(kw);
  if (!keywordSlug) {
    return { campaignId: null, keywordSlug: "", pages: [], error: "invalid slug" };
  }

  const clusterHint = options?.clusterHint ?? assignClusterSlug(kw, null) ?? undefined;
  const siteOrigin = (options?.siteOrigin ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.propertytools.ai").replace(
    /\/+$/,
    ""
  );

  const run = await insertSerpCampaign({ seedKeyword: kw, keywordSlug });
  if (run.error || !run.id) {
    return { campaignId: null, keywordSlug, pages: [], error: run.error ?? "campaign insert failed" };
  }

  const campaignId = run.id;
  const pages: SerpCampaignResult["pages"] = [];
  const clusterLinks = buildSerpClusterInternalLinks(keywordSlug, siteOrigin);

  for (const pageType of SERP_PAGE_TYPES) {
    const path = buildSerpHubPath(keywordSlug, pageType);
    const gen = await generateSerpPageForType(kw, pageType, clusterHint);

    if (!gen) {
      pages.push({ pageType, path, ok: false });
      continue;
    }

    const up = await upsertSerpPage({
      campaignId,
      pageType,
      path,
      title: gen.title,
      metaDescription: gen.meta_description,
      payload: gen.payload,
      snippetBlocks: gen.snippet_blocks,
      internalLinks: clusterLinks,
    });

    pages.push({ pageType, path, ok: up.ok });
  }

  const failed = pages.some((p) => !p.ok);
  await finalizeSerpCampaign(
    campaignId,
    failed ? "failed" : "completed",
    failed ? "One or more page generations failed" : null
  );

  return {
    campaignId,
    keywordSlug,
    pages,
    error: failed ? "Some pages failed to generate or save" : undefined,
  };
}
