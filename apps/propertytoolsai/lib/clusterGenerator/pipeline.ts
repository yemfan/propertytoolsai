import { getProgrammaticLocationBySlug, PROGRAMMATIC_SEO_LOCATIONS } from "@/lib/programmaticSeo/locations";
import { generateClusterContentWithAi } from "./aiClusterContent";
import {
  fetchExistingClusterPageKeys,
  insertClusterGenerationRun,
  upsertClusterPage,
  upsertClusterTopic,
} from "./db";
import { buildFallbackClusterPayload, buildFallbackMetadata } from "./fallbackContent";
import { buildInternalLinksForPage } from "./internalLinks";
import { CLUSTER_TOPICS, getClusterTopicBySlug, getAllClusterTopicSlugs } from "./topics";
import type { ClusterPagePayload } from "./types";

function clusterAiEnabledByDefault(): boolean {
  return process.env.CLUSTER_AI !== "false";
}

export async function seedClusterTopicsFromConfig(): Promise<{ ok: boolean; error?: string }> {
  for (const t of CLUSTER_TOPICS) {
    const r = await upsertClusterTopic(t);
    if (!r.ok) return r;
  }
  return { ok: true };
}

export type GenerateClusterResult = {
  topicSlug: string;
  locationSlug: string;
  status: "created" | "skipped" | "failed";
  message?: string;
};

/**
 * Generates one guide page: topic × location → AI or fallback → DB + internal links.
 */
export async function generateClusterPage(
  topicSlug: string,
  locationSlug: string,
  options?: { force?: boolean; useAi?: boolean }
): Promise<GenerateClusterResult> {
  const topic = getClusterTopicBySlug(topicSlug);
  const loc = getProgrammaticLocationBySlug(locationSlug);
  if (!topic) {
    return { topicSlug, locationSlug, status: "failed", message: "unknown topic" };
  }
  if (!loc) {
    return { topicSlug, locationSlug, status: "failed", message: "unknown location" };
  }

  const seed = await seedClusterTopicsFromConfig();
  if (!seed.ok) {
    return { topicSlug, locationSlug, status: "failed", message: seed.error ?? "topic seed failed" };
  }

  if (!options?.force) {
    const keys = await fetchExistingClusterPageKeys();
    if (keys.has(`${topicSlug}|${locationSlug}`)) {
      return { topicSlug, locationSlug, status: "skipped", message: "already exists" };
    }
  }

  const primaryKeyword = topic.keywords[0] ?? topic.name;
  const place = `${loc.city}, ${loc.state}`;
  const useAi = options?.useAi ?? clusterAiEnabledByDefault();

  let payload: ClusterPagePayload;
  let title: string;
  let description: string;

  if (useAi && process.env.OPENAI_API_KEY?.trim()) {
    const ai = await generateClusterContentWithAi({
      topic,
      city: loc.city,
      state: loc.state,
      place,
      primaryKeyword,
    });
    if (ai) {
      payload = ai.payload;
      title = ai.meta.title;
      description = ai.meta.description;
    } else {
      payload = buildFallbackClusterPayload(topic, loc, primaryKeyword);
      const fb = buildFallbackMetadata(topic, loc, primaryKeyword);
      title = fb.title;
      description = fb.description;
    }
  } else {
    payload = buildFallbackClusterPayload(topic, loc, primaryKeyword);
    const fb = buildFallbackMetadata(topic, loc, primaryKeyword);
    title = fb.title;
    description = fb.description;
  }

  const internalLinks = buildInternalLinksForPage(topicSlug, locationSlug);

  const up = await upsertClusterPage({
    topicSlug,
    locationSlug,
    city: loc.city,
    state: loc.state,
    primaryKeyword,
    title,
    metaDescription: description,
    payload,
    internalLinks,
    status: "published",
  });

  if (!up.ok) {
    return { topicSlug, locationSlug, status: "failed", message: up.error };
  }

  return { topicSlug, locationSlug, status: "created" };
}

/**
 * Picks the next N topic×location pairs not yet in `seo_cluster_pages`.
 */
export function pickMissingClusterCombinations(
  existing: Set<string>,
  limit: number
): { topicSlug: string; locationSlug: string }[] {
  const topics = getAllClusterTopicSlugs();
  const out: { topicSlug: string; locationSlug: string }[] = [];
  const seen = new Set(existing);

  outer: for (const topicSlug of topics) {
    for (const loc of PROGRAMMATIC_SEO_LOCATIONS) {
      const key = `${topicSlug}|${loc.slug}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ topicSlug, locationSlug: loc.slug });
      if (out.length >= limit) break outer;
    }
  }
  return out;
}

/**
 * Daily job: generate up to `CLUSTER_DAILY_LIMIT` missing pages (default 25).
 */
export async function runDailyClusterBatch(): Promise<{
  created: number;
  failed: number;
  results: GenerateClusterResult[];
}> {
  const limit = Number(process.env.CLUSTER_DAILY_LIMIT ?? 25);
  const existing = await fetchExistingClusterPageKeys();
  const pairs = pickMissingClusterCombinations(existing, Number.isFinite(limit) ? limit : 25);

  const results: GenerateClusterResult[] = [];
  let created = 0;
  let failed = 0;

  for (const p of pairs) {
    const r = await generateClusterPage(p.topicSlug, p.locationSlug, { force: true });
    results.push(r);
    if (r.status === "created") created++;
    if (r.status === "failed") failed++;
  }

  await insertClusterGenerationRun({
    kind: "daily",
    inputSummary: { limit, picked: pairs.length },
    pagesCreated: created,
    pagesFailed: failed,
  });

  return { created, failed, results };
}
