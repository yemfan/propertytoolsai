/**
 * Template variant lookup with locale fallback.
 *
 * The `templates` table stores an English canonical parent + zero-or-more
 * sibling variants with `variant_of` pointing at the parent's id and a
 * different `language`. Given a desired locale, return the best match.
 *
 * The lookup rule is simple and deliberately so:
 *   1. If a variant with this exact locale exists, return it.
 *   2. Otherwise return the English parent (which always exists by design).
 *
 * We intentionally do NOT auto-translate missing templates at runtime. A
 * template without a translated variant shipped means the team hasn't
 * validated the copy yet — serving a machine translation would bypass that
 * review gate and is exactly the kind of sloppiness that loses bilingual
 * agents. If a variant is missing, we fall back to English; the agent can
 * see that the ZH version hasn't been written yet and either write one via
 * the per-agent override or leave it English for that lead.
 */

import type { LocaleId } from "./registry";
import { DEFAULT_LOCALE } from "./registry";

export type TemplateRow = {
  id: string;
  /** For variants, points at the English parent's id. For parents, null. */
  variant_of: string | null;
  language: string;
  // The rest of the row is passed through unchanged so callers can take
  // whatever columns they were already fetching.
  [key: string]: unknown;
};

/**
 * Collapse a list of templates (parent + its variants) to the single row
 * that best matches the requested locale.
 *
 * Accepts the full result set from:
 *   SELECT * FROM templates
 *   WHERE id = :parentId OR variant_of = :parentId
 */
export function pickTemplateForLocale(
  rows: readonly TemplateRow[],
  locale: LocaleId,
): TemplateRow | null {
  if (rows.length === 0) return null;

  // Prefer an exact locale match first (variant or parent — parents keep
  // their own `language` field, which is almost always "en" but the
  // registry lets that evolve).
  const exact = rows.find((r) => r.language === locale);
  if (exact) return exact;

  // Fall back to the English parent (row with null variant_of).
  const parent = rows.find((r) => r.variant_of === null);
  if (parent) return parent;

  // Degenerate case: the rowset doesn't include a parent. Return the first
  // English variant we can find; if none, return the first row at all so
  // the caller doesn't null-out on edge-case data.
  const anyEn = rows.find((r) => r.language === DEFAULT_LOCALE);
  return anyEn ?? rows[0] ?? null;
}

/**
 * Given an arbitrary set of templates (possibly containing multiple roots
 * and their variants), group by root id and resolve each group to the
 * best match for the requested locale. Useful when rendering a library
 * view with N roots × M variants.
 */
export function pickTemplatesForLocale(
  rows: readonly TemplateRow[],
  locale: LocaleId,
): TemplateRow[] {
  const byRoot = new Map<string, TemplateRow[]>();
  for (const row of rows) {
    const rootId = row.variant_of ?? row.id;
    const group = byRoot.get(rootId);
    if (group) {
      group.push(row);
    } else {
      byRoot.set(rootId, [row]);
    }
  }
  const out: TemplateRow[] = [];
  for (const group of byRoot.values()) {
    const picked = pickTemplateForLocale(group, locale);
    if (picked) out.push(picked);
  }
  return out;
}
