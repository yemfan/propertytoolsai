import { supabaseServer } from "@/lib/supabaseServer";
import type { ProgrammaticSeoPayload } from "@/lib/programmaticSeo/types";
import type { SeoContentOverrideRow, SeoPageKey, SeoPerformanceSnapshot } from "./types";

/** Use when building pages: skips DB if service role is not configured. */
export async function fetchSeoContentOverrideSafe(pageKey: SeoPageKey): Promise<SeoContentOverrideRow | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) return null;
  try {
    return await fetchSeoContentOverride(pageKey);
  } catch (e) {
    console.warn("[seoOptimization] fetchSeoContentOverrideSafe", e);
    return null;
  }
}

export async function fetchSeoContentOverride(pageKey: SeoPageKey): Promise<SeoContentOverrideRow | null> {
  const { data, error } = await supabaseServer
    .from("seo_content_overrides")
    .select("*")
    .eq("page_key", pageKey)
    .maybeSingle();

  if (error) {
    console.warn("[seoOptimization] fetchSeoContentOverride", error.message);
    return null;
  }
  return (data as SeoContentOverrideRow) ?? null;
}

export async function upsertSeoContentOverride(input: {
  pageKey: SeoPageKey;
  urlPath: string;
  title: string | null;
  metaDescription: string | null;
  payload: ProgrammaticSeoPayload;
  abVariantId?: string | null;
  lastRunId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { data: existing } = await supabaseServer
    .from("seo_content_overrides")
    .select("version")
    .eq("page_key", input.pageKey)
    .maybeSingle();

  const nextVersion = (existing?.version as number | undefined) ? (existing.version as number) + 1 : 1;

  const row = {
    page_key: input.pageKey,
    url_path: input.urlPath,
    title: input.title,
    meta_description: input.metaDescription,
    payload_json: input.payload,
    ab_variant_id: input.abVariantId ?? null,
    version: nextVersion,
    updated_at: new Date().toISOString(),
    last_run_id: input.lastRunId ?? null,
  };

  const { error } = await supabaseServer.from("seo_content_overrides").upsert(row, {
    onConflict: "page_key",
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function insertPerformanceSnapshot(row: SeoPerformanceSnapshot): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseServer.from("seo_page_performance").upsert(
    {
      page_key: row.pageKey,
      url_path: row.urlPath ?? null,
      impressions: row.impressions,
      ctr: row.ctr,
      position_avg: row.positionAvg,
      period_start: row.periodStart ?? null,
      period_end: row.periodEnd ?? null,
      raw: row.raw ?? null,
    },
    { onConflict: "page_key,period_start,period_end" }
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function insertOptimizationRun(input: {
  pageKey: SeoPageKey;
  action: string;
  inputSnapshot: unknown;
  outputSnapshot: unknown;
  status: "success" | "failed" | "skipped";
  error?: string | null;
}): Promise<{ id: string | null; error?: string }> {
  const { data, error } = await supabaseServer
    .from("seo_optimization_runs")
    .insert({
      page_key: input.pageKey,
      action: input.action,
      input_snapshot: input.inputSnapshot as object,
      output_snapshot: input.outputSnapshot as object,
      status: input.status,
      error: input.error ?? null,
    })
    .select("id")
    .single();

  if (error) return { id: null, error: error.message };
  return { id: data?.id ?? null };
}

export async function upsertTitleAbVariant(input: {
  pageKey: SeoPageKey;
  variantLabel: string;
  title: string;
  impressions?: number;
  ctr?: number | null;
  positionAvg?: number | null;
  periodStart?: string | null;
  periodEnd?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseServer.from("seo_title_ab_variants").upsert(
    {
      page_key: input.pageKey,
      variant_label: input.variantLabel,
      title: input.title,
      impressions: input.impressions ?? 0,
      ctr: input.ctr ?? null,
      position_avg: input.positionAvg ?? null,
      period_start: input.periodStart ?? null,
      period_end: input.periodEnd ?? null,
    },
    { onConflict: "page_key,variant_label" }
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Latest performance row per page_key (by period_end). */
export async function listLatestPerformanceKeys(limit = 500): Promise<SeoPageKey[]> {
  const { data, error } = await supabaseServer
    .from("seo_page_performance")
    .select("page_key, period_end")
    .order("period_end", { ascending: false, nullsFirst: false })
    .limit(2000);

  if (error || !data?.length) return [];

  const seen = new Set<string>();
  const keys: string[] = [];
  for (const row of data) {
    const k = row.page_key as string;
    if (!seen.has(k)) {
      seen.add(k);
      keys.push(k);
      if (keys.length >= limit) break;
    }
  }
  return keys;
}

export async function getLatestPerformanceForPage(
  pageKey: SeoPageKey
): Promise<SeoPerformanceSnapshot | null> {
  const { data, error } = await supabaseServer
    .from("seo_page_performance")
    .select("*")
    .eq("page_key", pageKey)
    .order("period_end", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return {
    pageKey: data.page_key,
    urlPath: data.url_path,
    impressions: Number(data.impressions ?? 0),
    ctr: Number(data.ctr ?? 0),
    positionAvg: data.position_avg != null ? Number(data.position_avg) : null,
    periodStart: data.period_start,
    periodEnd: data.period_end,
    raw: (data.raw as Record<string, unknown>) ?? null,
  };
}
