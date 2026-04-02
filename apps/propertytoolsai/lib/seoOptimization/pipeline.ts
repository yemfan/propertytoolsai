import { buildFallbackPayload } from "@/lib/programmaticSeo/fallbackContent";
import { generateProgrammaticSeoWithAi } from "@/lib/programmaticSeo/aiGenerate";
import { getProgrammaticLocationBySlug } from "@/lib/programmaticSeo/locations";
import { getProgrammaticToolBySlug, getRelatedTools } from "@/lib/programmaticSeo/tools";
import type { ProgrammaticSeoPayload } from "@/lib/programmaticSeo/types";
import {
  fetchSeoContentOverride,
  getLatestPerformanceForPage,
  insertOptimizationRun,
  listLatestPerformanceKeys,
  upsertSeoContentOverride,
} from "./db";
import { getProgrammaticSeoStaticParams } from "@/lib/programmaticSeo";
import { decodeProgrammaticPageKey, encodeProgrammaticPageKey, programmaticUrlPath } from "./pageKey";
import { classifyOptimizationAction, getDefaultSeoRules } from "./rules";
import { mergeProgrammaticPayload } from "./mergePayload";
import { runAiOptimization } from "./aiOptimizer";
import type { OptimizationAction } from "./types";

function shouldUseProgrammaticAi(): boolean {
  return process.env.PROGRAMMATIC_SEO_AI === "true";
}

async function resolveBasePayload(toolSlug: string, locationSlug: string): Promise<ProgrammaticSeoPayload | null> {
  const tool = getProgrammaticToolBySlug(toolSlug);
  const loc = getProgrammaticLocationBySlug(locationSlug);
  if (!tool || !loc) return null;

  if (shouldUseProgrammaticAi()) {
    const ai = await generateProgrammaticSeoWithAi(tool, loc);
    if (ai) return ai;
  }
  return buildFallbackPayload(tool, loc);
}

export type PipelineResult = {
  pageKey: string;
  action: OptimizationAction;
  status: "success" | "skipped" | "failed";
  message?: string;
  runId?: string | null;
};

export async function runOptimizationForPageKey(pageKey: string, options?: { force?: boolean }): Promise<PipelineResult> {
  const parsed = decodeProgrammaticPageKey(pageKey);
  if (!parsed) {
    return { pageKey, action: "none", status: "failed", message: "invalid page_key" };
  }

  const { toolSlug, locationSlug } = parsed;
  const tool = getProgrammaticToolBySlug(toolSlug);
  const loc = getProgrammaticLocationBySlug(locationSlug);
  if (!tool || !loc) {
    return { pageKey, action: "none", status: "failed", message: "unknown tool or location" };
  }

  const perf = await getLatestPerformanceForPage(pageKey);
  const metrics = perf ?? {
    pageKey,
    impressions: 0,
    ctr: 0,
    positionAvg: null,
  };

  const rules = getDefaultSeoRules();
  let action = classifyOptimizationAction(
    {
      impressions: metrics.impressions,
      ctr: metrics.ctr,
      positionAvg: metrics.positionAvg,
    },
    rules
  );

  if (options?.force && action === "none") {
    action = "improve_content";
  }

  if (action === "none") {
    const run = await insertOptimizationRun({
      pageKey,
      action,
      inputSnapshot: { metrics, rules },
      outputSnapshot: { reason: "classifier returned none" },
      status: "skipped",
    });
    return { pageKey, action, status: "skipped", message: "no rule matched", runId: run.id };
  }

  const base = await resolveBasePayload(toolSlug, locationSlug);
  if (!base) {
    const run = await insertOptimizationRun({
      pageKey,
      action,
      inputSnapshot: { metrics },
      outputSnapshot: {},
      status: "failed",
      error: "could not resolve base payload",
    });
    return { pageKey, action, status: "failed", message: "no base payload", runId: run.id };
  }

  const existing = await fetchSeoContentOverride(pageKey);
  const mergedBase = existing?.payload_json
    ? mergeProgrammaticPayload(base, existing.payload_json)
    : base;

  const defaultTitle = `${tool.name} in ${loc.city}, ${loc.state} | Free Online Tool | PropertyTools AI`;
  const defaultDescription = `Free ${tool.name.toLowerCase()} for ${loc.city}, ${loc.state}. ${tool.tagline} Run scenarios, compare options, and plan your next move.`;

  const related = getRelatedTools(tool.slug, 5);
  const relatedNames = related.map((r) => r.name);

  const ai = await runAiOptimization({
    action,
    toolName: tool.name,
    toolCategory: tool.category,
    toolTagline: tool.tagline,
    city: loc.city,
    state: loc.state,
    metrics: {
      impressions: metrics.impressions,
      ctr: metrics.ctr,
      positionAvg: metrics.positionAvg,
    },
    defaultTitle,
    defaultDescription,
    basePayload: mergedBase,
    relatedToolNames: relatedNames,
  });

  if (!ai) {
    const run = await insertOptimizationRun({
      pageKey,
      action,
      inputSnapshot: { metrics, defaultTitle },
      outputSnapshot: {},
      status: "failed",
      error: "AI returned no content",
    });
    return { pageKey, action, status: "failed", message: "AI unavailable or invalid output", runId: run.id };
  }

  const urlPath = programmaticUrlPath(toolSlug, locationSlug);
  const runInsert = await insertOptimizationRun({
    pageKey,
    action,
    inputSnapshot: { metrics, rules },
    outputSnapshot: {
      title: ai.title,
      meta_description: ai.meta_description,
      internal_link_suggestions: ai.internal_link_suggestions,
    },
    status: "success",
  });

  const up = await upsertSeoContentOverride({
    pageKey,
    urlPath,
    title: ai.title,
    metaDescription: ai.meta_description,
    payload: { ...ai.payload, source: "ai" },
    lastRunId: runInsert.id,
  });

  if (!up.ok) {
    await insertOptimizationRun({
      pageKey,
      action,
      inputSnapshot: {},
      outputSnapshot: {},
      status: "failed",
      error: up.error ?? "upsert failed",
    });
    return { pageKey, action, status: "failed", message: up.error, runId: runInsert.id };
  }

  return { pageKey, action, status: "success", runId: runInsert.id };
}

export async function runWeeklyBatch(options?: { limit?: number; force?: boolean }): Promise<{
  processed: PipelineResult[];
  skipped?: true;
  reason?: string;
}> {
  const limitRaw = options?.limit ?? Number(process.env.SEO_OPT_WEEKLY_LIMIT ?? "0");
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : 0;
  if (limit <= 0) {
    return {
      processed: [],
      skipped: true,
      reason: "SEO_OPT_WEEKLY_LIMIT is 0 or unset — set a positive integer to run the batch",
    };
  }

  const keysEnv = process.env.SEO_OPT_PAGE_KEYS;
  let keys: string[];

  if (keysEnv?.trim()) {
    keys = keysEnv.split(",").map((k) => k.trim()).filter(Boolean);
  } else {
    keys = await listLatestPerformanceKeys(Math.max(limit * 2, 100));
  }

  if (keys.length === 0 && process.env.SEO_OPT_INCLUDE_ALL_PAGES === "true") {
    keys = getProgrammaticSeoStaticParams().map((p) => encodeProgrammaticPageKey(p.toolSlug, p.locationSlug));
  }

  if (keys.length === 0) {
    return { processed: [] };
  }

  const processed: PipelineResult[] = [];
  const forceForBatch =
    Boolean(options?.force) || process.env.SEO_OPT_INCLUDE_ALL_PAGES === "true";

  for (const pageKey of keys.slice(0, limit)) {
    const r = await runOptimizationForPageKey(pageKey, { force: forceForBatch });
    processed.push(r);
  }
  return { processed };
}

/** Encode slugs for callers that have tool + location only. */
export function pageKeyFromSlugs(toolSlug: string, locationSlug: string): string {
  return encodeProgrammaticPageKey(toolSlug, locationSlug);
}
