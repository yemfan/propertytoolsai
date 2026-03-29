import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildSeoSlug } from "./slug";
import type { SeoGeneratorInput } from "./types";

const CHUNK = 200;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function isMissingTable(message: string, table: string): boolean {
  const m = message.toLowerCase();
  return m.includes(table) && (m.includes("does not exist") || m.includes("schema cache"));
}

async function selectSlugsIn(table: string, slugs: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  for (const part of chunk(slugs, CHUNK)) {
    if (!part.length) continue;
    const { data, error } = await supabaseAdmin.from(table).select("slug").in("slug", part);
    if (error) {
      if (!isMissingTable(error.message, table)) {
        console.warn(`[seo dedupe] ${table}:`, error.message);
      }
      throw error;
    }
    for (const row of data ?? []) {
      const s = (row as { slug?: string }).slug;
      if (s) found.add(s);
    }
  }
  return found;
}

/**
 * Keep inputs whose slug is not already in `seo_pages` or `seo_expansion_queue`.
 */
export async function filterNewSeoInputs(inputs: SeoGeneratorInput[]): Promise<SeoGeneratorInput[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.warn("[seo dedupe] SUPABASE_SERVICE_ROLE_KEY not set; skipping dedupe");
    return inputs;
  }
  if (!inputs.length) return [];

  const slugs = [...new Set(inputs.map(buildSeoSlug))];

  let existingPages: Set<string>;
  let queued: Set<string>;
  try {
    [existingPages, queued] = await Promise.all([
      selectSlugsIn("seo_pages", slugs),
      selectSlugsIn("seo_expansion_queue", slugs),
    ]);
  } catch {
    return [];
  }

  return inputs.filter((input) => {
    const slug = buildSeoSlug(input);
    return !existingPages.has(slug) && !queued.has(slug);
  });
}
