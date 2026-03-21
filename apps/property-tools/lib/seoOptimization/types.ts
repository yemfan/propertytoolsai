import type { ProgrammaticSeoPayload } from "@/lib/programmaticSeo/types";

/** Stable key for programmatic SEO pages: `tool|{toolSlug}|{locationSlug}` */
export type SeoPageKey = string;

export type SeoPerformanceSnapshot = {
  pageKey: SeoPageKey;
  urlPath?: string | null;
  impressions: number;
  ctr: number;
  positionAvg: number | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  raw?: Record<string, unknown> | null;
};

export type OptimizationAction =
  | "rewrite_full"
  | "improve_content"
  | "improve_title_meta"
  | "add_faqs"
  | "none";

export type SeoContentOverrideRow = {
  page_key: string;
  url_path: string | null;
  title: string | null;
  meta_description: string | null;
  payload_json: ProgrammaticSeoPayload | Record<string, unknown>;
  ab_variant_id: string | null;
  version: number;
  updated_at: string;
  last_run_id: string | null;
};

export type SeoMetaOverride = {
  title?: string;
  description?: string;
};

export type LoadProgrammaticSeoExtras = {
  seoMeta?: SeoMetaOverride;
  /** When true, merged payload came from DB override (for optional UI). */
  hasSeoOverride?: boolean;
};
