import type { SeoPageKey } from "./types";

const PREFIX = "tool";

/** Encode programmatic page key for DB + APIs. */
export function encodeProgrammaticPageKey(toolSlug: string, locationSlug: string): SeoPageKey {
  return `${PREFIX}|${toolSlug}|${locationSlug}`;
}

export function decodeProgrammaticPageKey(
  pageKey: string
): { toolSlug: string; locationSlug: string } | null {
  const parts = pageKey.split("|");
  if (parts.length !== 3 || parts[0] !== PREFIX) return null;
  const toolSlug = parts[1]?.trim();
  const locationSlug = parts[2]?.trim();
  if (!toolSlug || !locationSlug) return null;
  return { toolSlug, locationSlug };
}

export function programmaticUrlPath(toolSlug: string, locationSlug: string): string {
  return `/tool/${toolSlug}/${locationSlug}`;
}
