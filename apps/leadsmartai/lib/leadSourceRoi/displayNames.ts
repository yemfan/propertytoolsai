/**
 * Humanized labels for `contacts.source` values that the report surfaces.
 *
 * Why a static map vs. a join to a `lead_sources` table: the source values
 * are emitted by code (route handlers + form posts) — the label is a
 * presentation concern, not data. Adding a dedicated table would create a
 * second source of truth that's easy to drift from the actual emitted
 * strings. A code-side map keeps the canonical names co-located with the
 * code that emits them; new sources fall through to a `humanizeSource`
 * fallback so the UI never breaks on an unmapped value.
 *
 * Update cadence: when a new lead-capture surface ships, drop the source
 * key + label in here. CI's lint check on this file (eventually) can flag
 * unused entries; for now, the codebase is small enough to grep.
 */

const KNOWN_SOURCE_LABELS: Record<string, string> = {
  // Consumer-facing IDX surfaces
  idx_homes_for_sale: "IDX home search",

  // Marketing pages
  voice_ai_demo: "Voice AI demo (agent prospect)",
  home_value: "Home-value estimator",
  progressive_capture: "Progressive lead capture",
  open_house: "Open-house signup",

  // Sphere / past-client paths
  sphere_import: "Sphere import (CSV)",
  manual: "Manual entry (CRM)",
  crm: "Manual entry (CRM)",

  // Marketplace / partners
  zillow: "Zillow",
  realtor_com: "Realtor.com",
  redfin: "Redfin",

  // Bucket for null / empty source values
  __unknown__: "Unknown / unattributed",
};

/**
 * Pure: bucket key for a raw `contacts.source` value. Null/blank → __unknown__
 * so the aggregator collapses every "no source" lead into a single row.
 */
export function bucketKeyFor(rawSource: string | null | undefined): string {
  if (!rawSource || typeof rawSource !== "string") return "__unknown__";
  const trimmed = rawSource.trim().toLowerCase();
  return trimmed || "__unknown__";
}

/**
 * Pure: humanize a source key for display. Falls through to a Title Case
 * conversion of the raw key when no mapping exists, so unmapped sources
 * still render as something readable.
 */
export function labelForSourceKey(key: string): string {
  if (key in KNOWN_SOURCE_LABELS) return KNOWN_SOURCE_LABELS[key];
  return humanizeSource(key);
}

/**
 * Title-case fallback for unmapped sources. "facebook_lead_form" → "Facebook
 * lead form". Hardens against ALLCAPS / weird-spacing inputs.
 */
function humanizeSource(key: string): string {
  if (!key || key === "__unknown__") return KNOWN_SOURCE_LABELS.__unknown__;
  const words = key
    .replace(/[_\-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return KNOWN_SOURCE_LABELS.__unknown__;
  return words
    .map((w, i) =>
      i === 0
        ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
        : w.toLowerCase(),
    )
    .join(" ");
}

/**
 * Stable ordering for the report rows when conversion / volume tie. Keeps
 * the table deterministic across runs.
 */
export function sourceKeySortIndex(key: string): number {
  // __unknown__ always sorts last so a sea of unattributed leads doesn't
  // crowd the meaningful sources at the top.
  if (key === "__unknown__") return 1_000_000;
  // Prefer the explicit mapping order for known sources (mostly the same
  // as alphabetical, but lets us nudge important sources up later).
  const known = Object.keys(KNOWN_SOURCE_LABELS).indexOf(key);
  if (known >= 0) return known;
  // Unknown-but-not-empty: sort after known sources, alphabetical.
  return 100_000 + key.charCodeAt(0);
}
