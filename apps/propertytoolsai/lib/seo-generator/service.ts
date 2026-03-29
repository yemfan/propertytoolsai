import { getSeoPageBySlugFromDb, upsertSeoPage } from "./db";
import { generateSeoPageContent } from "./content";
import { DEFAULT_SEO_SEED_INPUTS } from "./seeds";
import { buildSeoSlug, parseSeoSlugToInput } from "./slug";
import type { SeoGeneratedPage, SeoGeneratorInput } from "./types";

/** @deprecated Prefer {@link DEFAULT_SEO_SEED_INPUTS} from `./seeds`. */
export const SEO_GENERATOR_SEED_INPUTS = DEFAULT_SEO_SEED_INPUTS;

function defaultStateFromEnv(): string {
  return process.env.NEXT_PUBLIC_DEFAULT_STATE?.trim() || "CA";
}

export function isSeoGeneratedPage(v: unknown): v is SeoGeneratedPage {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.slug === "string" &&
    typeof o.metaTitle === "string" &&
    typeof o.metaDescription === "string" &&
    typeof o.h1 === "string"
  );
}

/**
 * Published row in `seo_pages` (fast path). If missing, falls back to slug parse + seed inputs
 * so routes work before the first batch job.
 */
export async function getGeneratedSeoPageBySlug(slug: string): Promise<SeoGeneratedPage | null> {
  const normalized = slug.trim().toLowerCase();

  const existing = await getSeoPageBySlugFromDb(normalized);
  if (existing?.page_json && isSeoGeneratedPage(existing.page_json)) {
    const page = existing.page_json as SeoGeneratedPage;
    if (page.slug === normalized) return page;
  }

  const state = defaultStateFromEnv();
  const parsed = parseSeoSlugToInput(normalized, state);
  if (parsed && buildSeoSlug(parsed) === normalized) {
    return generateSeoPageContent(parsed);
  }

  for (const input of DEFAULT_SEO_SEED_INPUTS) {
    const page = await generateSeoPageContent(input);
    if (page.slug === normalized) return page;
  }

  return null;
}

export async function generateAndStoreSeoPage(input: SeoGeneratorInput) {
  const page = await generateSeoPageContent(input);
  await upsertSeoPage(input, page);
  return page;
}

export async function ensureSeoPage(input: SeoGeneratorInput) {
  const slug = buildSeoSlug(input);
  const existing = await getSeoPageBySlugFromDb(slug);
  if (existing?.page_json && isSeoGeneratedPage(existing.page_json)) {
    return existing.page_json as SeoGeneratedPage;
  }
  return generateAndStoreSeoPage(input);
}

export async function generateBatchSeoPages(inputs: SeoGeneratorInput[]) {
  const pages: SeoGeneratedPage[] = [];
  for (const input of inputs) {
    pages.push(await generateSeoPageContent(input));
  }
  return pages;
}

export function listKnownSeoSlugs(): string[] {
  return DEFAULT_SEO_SEED_INPUTS.map((input) => buildSeoSlug(input));
}
