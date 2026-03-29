import { unstable_cache } from "next/cache";
import { fetchSeoContentOverrideSafe } from "@/lib/seoOptimization/db";
import { mergeProgrammaticPayload, parseOverridePayload } from "@/lib/seoOptimization/mergePayload";
import { encodeProgrammaticPageKey } from "@/lib/seoOptimization/pageKey";
import type { LoadProgrammaticSeoExtras } from "@/lib/seoOptimization/types";
import { generateProgrammaticSeoWithAi } from "./aiGenerate";
import { buildFallbackPayload } from "./fallbackContent";
import { getProgrammaticLocationBySlug } from "./locations";
import { getProgrammaticToolBySlug } from "./tools";
import type { ProgrammaticSeoPayload } from "./types";

/**
 * Opt-in AI for programmatic pages (cost control). Fallback templates always work.
 * Set PROGRAMMATIC_SEO_AI=true and OPENAI_API_KEY to enable cached OpenAI generation.
 */
function shouldUseAi(): boolean {
  return process.env.PROGRAMMATIC_SEO_AI === "true";
}

async function resolvePayload(toolSlug: string, locationSlug: string): Promise<ProgrammaticSeoPayload | null> {
  const tool = getProgrammaticToolBySlug(toolSlug);
  const loc = getProgrammaticLocationBySlug(locationSlug);
  if (!tool || !loc) return null;

  if (shouldUseAi()) {
    const ai = await generateProgrammaticSeoWithAi(tool, loc);
    if (ai) return ai;
  }

  return buildFallbackPayload(tool, loc);
}

/**
 * Cached for 7 days per (tool, location). Reduces OpenAI calls when PROGRAMMATIC_SEO_AI=true.
 */
export const getCachedProgrammaticPayload = unstable_cache(
  async (toolSlug: string, locationSlug: string) => resolvePayload(toolSlug, locationSlug),
  ["programmatic-seo-payload-v1"],
  { revalidate: 60 * 60 * 24 * 7 }
);

export async function loadProgrammaticSeoPage(
  toolSlug: string,
  locationSlug: string
): Promise<{
  tool: NonNullable<ReturnType<typeof getProgrammaticToolBySlug>>;
  loc: NonNullable<ReturnType<typeof getProgrammaticLocationBySlug>>;
  payload: ProgrammaticSeoPayload;
} & LoadProgrammaticSeoExtras | null> {
  const tool = getProgrammaticToolBySlug(toolSlug);
  const loc = getProgrammaticLocationBySlug(locationSlug);
  if (!tool || !loc) return null;

  const base = await getCachedProgrammaticPayload(toolSlug, locationSlug);
  if (!base) return null;

  const pageKey = encodeProgrammaticPageKey(toolSlug, locationSlug);
  const override = await fetchSeoContentOverrideSafe(pageKey);

  let payload = base;
  let seoMeta: LoadProgrammaticSeoExtras["seoMeta"];
  let hasSeoOverride = false;

  if (override) {
    payload = mergeProgrammaticPayload(base, override.payload_json);
    if (override.title?.trim() || override.meta_description?.trim()) {
      seoMeta = {
        title: override.title?.trim() || undefined,
        description: override.meta_description?.trim() || undefined,
      };
    }
    hasSeoOverride = Boolean(
      (override.title && override.title.trim()) ||
        (override.meta_description && override.meta_description.trim()) ||
        parseOverridePayload(override.payload_json) !== null
    );
  }

  return { tool, loc, payload, seoMeta, hasSeoOverride };
}
