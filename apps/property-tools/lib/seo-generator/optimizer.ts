/**
 * Deterministic SEO tweaks for underperforming published pages (traffic but few leads).
 *
 * Not implemented here (by design): OpenAI rewrites, `seo_page_variants` A/B tables, RPC counters,
 * or cloning winners into synthetic slugs — add those when you have guardrails and editorial review.
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import { updateSeoPageFromGeneratedPage } from "./db";
import { isSeoGeneratedPage } from "./service";
import type { SeoGeneratedPage } from "./types";

const TABLE = "seo_pages";

const INTRO_TAIL = " Get personalized matches and see homes that fit your real budget.";
const META_TAIL = " Smart Match ranks options to your budget and goals.";
const H1_SUFFIX = " (Updated daily)";
const CTA_LABEL = "Find homes you can actually afford";
const CTA_DESC_TAIL = " Act now while inventory is available.";

export function applyDeterministicSeoOptimizations(page: SeoGeneratedPage): SeoGeneratedPage {
  let intro = page.intro;
  if (!intro.includes("personalized matches")) {
    intro = intro.trimEnd() + INTRO_TAIL;
  }

  let h1 = page.h1;
  if (!h1.includes("(Updated daily)")) {
    h1 = `${h1}${H1_SUFFIX}`;
  }

  let metaDescription = page.metaDescription;
  if (!metaDescription.includes("Smart Match ranks")) {
    metaDescription = metaDescription.trimEnd() + META_TAIL;
  }

  let ctaDescription = page.calculatorCta.description;
  if (!ctaDescription.includes("Act now while inventory")) {
    ctaDescription = ctaDescription.trimEnd() + CTA_DESC_TAIL;
  }

  const calculatorCta = {
    ...page.calculatorCta,
    label: CTA_LABEL,
    description: ctaDescription,
  };

  return {
    ...page,
    intro,
    h1,
    metaDescription,
    calculatorCta,
  };
}

export type UnderperformingSeoRow = {
  slug: string;
  visit_count: number | null;
  lead_count: number | null;
  page_json: unknown;
};

export async function listUnderperformingSeoPages(options: {
  minVisits?: number;
  /** Rows with `lead_count` strictly less than this (default 5 → 0–4 leads). */
  maxLeadCountExclusive?: number;
  limit?: number;
}): Promise<UnderperformingSeoRow[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) return [];

  const minVisits = options.minVisits ?? 100;
  const maxLeadCountExclusive = options.maxLeadCountExclusive ?? 5;
  const limit = options.limit ?? 25;

  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select("slug, visit_count, lead_count, page_json")
    .eq("status", "published")
    .gt("visit_count", minVisits)
    .lt("lead_count", maxLeadCountExclusive)
    .order("visit_count", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[seo optimizer] listUnderperformingSeoPages:", error.message);
    return [];
  }

  return (data ?? []) as UnderperformingSeoRow[];
}

export async function listTopRevenueSeoPages(minRevenue = 10_000, limit = 10) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) return [];

  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select("slug, revenue_amount, visit_count, lead_count")
    .eq("status", "published")
    .gt("revenue_amount", minRevenue)
    .order("revenue_amount", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[seo optimizer] listTopRevenueSeoPages:", error.message);
    return [];
  }

  return data ?? [];
}

export type SeoOptimizationBatchResult = {
  examined: number;
  updated: number;
  skipped: number;
  failures: number;
  slugs: string[];
};

export async function runSeoOptimizationBatch(options?: {
  minVisits?: number;
  maxLeadCountExclusive?: number;
  limit?: number;
}): Promise<SeoOptimizationBatchResult> {
  const rows = await listUnderperformingSeoPages({
    minVisits: options?.minVisits,
    maxLeadCountExclusive: options?.maxLeadCountExclusive,
    limit: options?.limit,
  });

  let updated = 0;
  let skipped = 0;
  let failures = 0;
  const slugs: string[] = [];

  for (const row of rows) {
    const slug = String(row.slug ?? "").trim().toLowerCase();
    if (!slug) {
      skipped++;
      continue;
    }

    if (!isSeoGeneratedPage(row.page_json)) {
      skipped++;
      continue;
    }

    const before = row.page_json as SeoGeneratedPage;
    if (before.slug !== slug) {
      skipped++;
      continue;
    }

    const after = applyDeterministicSeoOptimizations(before);
    if (JSON.stringify(before) === JSON.stringify(after)) {
      skipped++;
      continue;
    }

    const ok = await updateSeoPageFromGeneratedPage(slug, after);
    if (ok) {
      updated++;
      slugs.push(slug);
    } else {
      failures++;
    }
  }

  return {
    examined: rows.length,
    updated,
    skipped,
    failures,
    slugs,
  };
}
