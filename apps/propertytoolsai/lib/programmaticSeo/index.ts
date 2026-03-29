import { PROGRAMMATIC_SEO_LOCATIONS } from "./locations";
import { PROGRAMMATIC_SEO_TOOLS } from "./tools";

export type { ProgrammaticSeoLocation, ProgrammaticSeoPayload, ProgrammaticSeoTool } from "./types";
export type { LoadProgrammaticSeoExtras } from "@/lib/seoOptimization/types";
export { PROGRAMMATIC_SEO_TOOLS, getProgrammaticToolBySlug, getRelatedTools } from "./tools";
export { PROGRAMMATIC_SEO_LOCATIONS, getProgrammaticLocationBySlug } from "./locations";
export { loadProgrammaticSeoPage, getCachedProgrammaticPayload } from "./getPageContent";
export { buildFallbackPayload } from "./fallbackContent";
export { generateProgrammaticSeoWithAi } from "./aiGenerate";

export function getProgrammaticSeoStaticParams() {
  const out: { toolSlug: string; locationSlug: string }[] = [];
  for (const t of PROGRAMMATIC_SEO_TOOLS) {
    for (const l of PROGRAMMATIC_SEO_LOCATIONS) {
      out.push({ toolSlug: t.slug, locationSlug: l.slug });
    }
  }
  return out;
}

export function getProgrammaticSeoUrlPaths(): string[] {
  return getProgrammaticSeoStaticParams().map((p) => `/tool/${p.toolSlug}/${p.locationSlug}`);
}

export const PROGRAMMATIC_SEO_PAGE_COUNT = PROGRAMMATIC_SEO_TOOLS.length * PROGRAMMATIC_SEO_LOCATIONS.length;
