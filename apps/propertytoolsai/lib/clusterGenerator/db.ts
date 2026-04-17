import { supabaseServer } from "@/lib/supabaseServer";
import { buildGuidePath } from "./slug";
import type { ClusterInternalLink, ClusterPagePayload, ClusterTopicDefinition } from "./types";

export async function upsertClusterTopic(row: ClusterTopicDefinition): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseServer.from("seo_cluster_topics").upsert(
    {
      slug: row.slug,
      name: row.name,
      keywords: row.keywords,
      related_slugs: row.relatedSlugs,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "slug" }
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function upsertClusterPage(input: {
  topicSlug: string;
  locationSlug: string;
  city: string;
  state: string;
  primaryKeyword: string;
  title: string;
  metaDescription: string;
  payload: ClusterPagePayload;
  internalLinks: ClusterInternalLink[];
  status?: "draft" | "published";
}): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseServer.from("seo_cluster_pages").upsert(
    {
      topic_slug: input.topicSlug,
      location_slug: input.locationSlug,
      city: input.city,
      state: input.state,
      primary_keyword: input.primaryKeyword,
      title: input.title,
      meta_description: input.metaDescription,
      payload: input.payload,
      internal_links: input.internalLinks,
      status: input.status ?? "published",
      ai_source: input.payload.source === "ai" ? "openai" : "fallback",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "topic_slug,location_slug" }
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export type ClusterPageRow = {
  topic_slug: string;
  location_slug: string;
  city: string;
  state: string;
  primary_keyword: string | null;
  title: string;
  meta_description: string;
  payload: ClusterPagePayload;
  internal_links: ClusterInternalLink[];
  status: string;
};

export async function getClusterPage(
  topicSlug: string,
  locationSlug: string
): Promise<ClusterPageRow | null> {
  const { data, error } = await supabaseServer
    .from("seo_cluster_pages")
    .select("*")
    .eq("topic_slug", topicSlug)
    .eq("location_slug", locationSlug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    console.warn("[clusterGenerator] getClusterPage", error.message);
    return null;
  }
  if (!data) return null;
  return data as unknown as ClusterPageRow;
}

/** Keys for deduping generation: `topic|location` */
export async function fetchExistingClusterPageKeys(): Promise<Set<string>> {
  const { data, error } = await supabaseServer.from("seo_cluster_pages").select("topic_slug, location_slug");
  if (error || !data) return new Set();
  return new Set(data.map((r) => `${r.topic_slug as string}|${r.location_slug as string}`));
}

export async function listPublishedClusterParams(): Promise<{ topicSlug: string; locationSlug: string }[]> {
  const { data, error } = await supabaseServer
    .from("seo_cluster_pages")
    .select("topic_slug, location_slug")
    .eq("status", "published")
    .limit(20000);

  if (error || !data) return [];
  return data.map((r) => ({
    topicSlug: r.topic_slug as string,
    locationSlug: r.location_slug as string,
  }));
}

export async function getClusterGuidePathsForSitemap(): Promise<string[]> {
  const params = await listPublishedClusterParams();
  return params.map((p) => buildGuidePath(p.topicSlug, p.locationSlug));
}

/**
 * Same set as {@link getClusterGuidePathsForSitemap} but with per-row
 * `updated_at`. Used by app/sitemap.ts to emit an honest, per-URL lastmod
 * instead of the synthetic `new Date()` that was flagged in the April 2026
 * validation report (SEO-03).
 */
export async function listClusterGuideEntriesForSitemap(): Promise<
  { path: string; updatedAt: string | null }[]
> {
  const { data, error } = await supabaseServer
    .from("seo_cluster_pages")
    .select("topic_slug, location_slug, updated_at")
    .eq("status", "published")
    .limit(20000);
  if (error || !data) return [];
  return data.map((r) => ({
    path: buildGuidePath(r.topic_slug as string, r.location_slug as string),
    updatedAt: (r.updated_at as string | null) ?? null,
  }));
}

export async function insertClusterGenerationRun(input: {
  kind?: string;
  inputSummary?: unknown;
  pagesCreated: number;
  pagesFailed: number;
  error?: string | null;
}): Promise<void> {
  await supabaseServer.from("seo_cluster_generation_runs").insert({
    kind: input.kind ?? "batch",
    input_summary: input.inputSummary ?? null,
    pages_created: input.pagesCreated,
    pages_failed: input.pagesFailed,
    error: input.error ?? null,
  });
}
