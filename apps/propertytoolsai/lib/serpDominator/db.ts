import { supabaseServer } from "@/lib/supabaseServer";
import type { SerpInternalLink } from "./types";
import type { SerpPagePayload } from "./types";
import type { SnippetBlock } from "./types";

export type SerpPageRow = {
  id: string;
  campaign_id: string;
  page_type: string;
  path: string;
  title: string;
  meta_description: string;
  payload: SerpPagePayload;
  snippet_blocks: SnippetBlock[];
  internal_links: SerpInternalLink[];
  status: string;
};

export async function insertSerpCampaign(input: {
  seedKeyword: string;
  keywordSlug: string;
}): Promise<{ id: string | null; error?: string }> {
  const { data, error } = await supabaseServer
    .from("serp_dominator_campaigns")
    .upsert(
      {
        seed_keyword: input.seedKeyword,
        keyword_slug: input.keywordSlug,
        status: "draft",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "keyword_slug" }
    )
    .select("id")
    .single();

  if (error) return { id: null, error: error.message };
  return { id: data?.id ?? null };
}

export async function finalizeSerpCampaign(
  campaignId: string,
  status: "completed" | "failed",
  error?: string | null
): Promise<void> {
  await supabaseServer
    .from("serp_dominator_campaigns")
    .update({
      status,
      error: error ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);
}

export async function upsertSerpPage(input: {
  campaignId: string;
  pageType: string;
  path: string;
  title: string;
  metaDescription: string;
  payload: SerpPagePayload;
  snippetBlocks: SnippetBlock[];
  internalLinks: SerpInternalLink[];
}): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseServer.from("serp_dominator_pages").upsert(
    {
      campaign_id: input.campaignId,
      page_type: input.pageType,
      path: input.path,
      title: input.title,
      meta_description: input.metaDescription,
      payload: input.payload,
      snippet_blocks: input.snippetBlocks,
      internal_links: input.internalLinks,
      status: "published",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "campaign_id,page_type" }
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getSerpPageByPath(path: string): Promise<SerpPageRow | null> {
  const { data, error } = await supabaseServer
    .from("serp_dominator_pages")
    .select("*")
    .eq("path", path)
    .eq("status", "published")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as SerpPageRow;
}

export async function listSerpHubPathsForSitemap(): Promise<string[]> {
  const { data, error } = await supabaseServer.from("serp_dominator_pages").select("path").eq("status", "published").limit(10000);

  if (error || !data) return [];
  return data.map((r) => r.path as string);
}

/**
 * Same set as {@link listSerpHubPathsForSitemap} but with per-row
 * `updated_at`. Used by app/sitemap.ts to emit honest per-URL lastmod
 * (validation report SEO-03 fix).
 */
export async function listSerpHubEntriesForSitemap(): Promise<
  { path: string; updatedAt: string | null }[]
> {
  const { data, error } = await supabaseServer
    .from("serp_dominator_pages")
    .select("path, updated_at")
    .eq("status", "published")
    .limit(10000);
  if (error || !data) return [];
  return data.map((r) => ({
    path: r.path as string,
    updatedAt: (r.updated_at as string | null) ?? null,
  }));
}

/** Hub index: campaigns that have at least one published page (deduped, newest first). */
export type SerpHubCampaignListItem = {
  seed_keyword: string;
  keyword_slug: string;
  updated_at: string;
};

export async function listSerpHubCampaignsWithPublishedPages(limit = 80): Promise<SerpHubCampaignListItem[]> {
  const { data: campaigns, error: cErr } = await supabaseServer
    .from("serp_dominator_campaigns")
    .select("id, seed_keyword, keyword_slug, updated_at")
    .eq("status", "completed")
    .order("updated_at", { ascending: false })
    .limit(500);

  if (cErr || !campaigns?.length) return [];

  const ids = campaigns.map((c) => c.id as string);
  const { data: pageRows, error: pErr } = await supabaseServer
    .from("serp_dominator_pages")
    .select("campaign_id")
    .eq("status", "published")
    .in("campaign_id", ids);

  if (pErr || !pageRows?.length) return [];

  const withPages = new Set(pageRows.map((r) => r.campaign_id as string));
  const filtered = campaigns.filter((c) => withPages.has(c.id as string));

  return filtered.slice(0, limit).map((c) => ({
    seed_keyword: c.seed_keyword as string,
    keyword_slug: c.keyword_slug as string,
    updated_at: c.updated_at as string,
  }));
}

export async function insertRankSnapshot(input: {
  keywordNormalized: string;
  pagePath: string;
  position: number | null;
  urlInSerp?: string | null;
  source?: string;
  notes?: string | null;
  recordedAt?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseServer.from("serp_rank_snapshots").upsert(
    {
      keyword_normalized: input.keywordNormalized,
      page_path: input.pagePath,
      position: input.position,
      url_in_serp: input.urlInSerp ?? null,
      source: input.source ?? "manual",
      notes: input.notes ?? null,
      recorded_at: input.recordedAt ?? new Date().toISOString().slice(0, 10),
    },
    { onConflict: "keyword_normalized,page_path,recorded_at" }
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function listRankSnapshotsForKeyword(keywordNormalized: string, limit = 90): Promise<
  {
    page_path: string;
    position: number | null;
    recorded_at: string;
    source: string;
  }[]
> {
  const { data, error } = await supabaseServer
    .from("serp_rank_snapshots")
    .select("page_path, position, recorded_at, source")
    .eq("keyword_normalized", keywordNormalized)
    .order("recorded_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as { page_path: string; position: number | null; recorded_at: string; source: string }[];
}
