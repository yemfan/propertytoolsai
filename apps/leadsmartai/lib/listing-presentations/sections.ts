/**
 * Pure section model for listing presentations.
 *
 * The presentation's `sections` JSONB is an ordered array of
 * section descriptors. The renderer walks the array and emits
 * one slide per enabled section. Adding a new kind = one new
 * entry in `SECTION_KINDS` + one renderer case downstream.
 *
 * Pure module — vitest hits the validation + readiness logic
 * without DB.
 */

export const SECTION_KINDS = [
  "cover",
  "agent_bio",
  "cma",
  "pricing_strategy",
  "marketing_plan",
  "testimonials",
  "net_to_seller",
  "next_steps",
] as const;

export type SectionKind = (typeof SECTION_KINDS)[number];

export type Section = {
  type: SectionKind;
  enabled: boolean;
  /** Per-kind config, e.g. for cma: which comparables to feature.
   *  Free-form jsonb so we don't need migrations to evolve a
   *  section's options. */
  config?: Record<string, unknown>;
};

export const DEFAULT_SECTIONS: Section[] = [
  { type: "cover", enabled: true },
  { type: "agent_bio", enabled: true },
  { type: "cma", enabled: true },
  { type: "pricing_strategy", enabled: true },
  { type: "marketing_plan", enabled: true },
  { type: "testimonials", enabled: true },
  { type: "net_to_seller", enabled: true },
  { type: "next_steps", enabled: true },
];

/**
 * Validate + canonicalize an inbound sections array. Used both
 * on update (the agent reordered sections in the UI) and on read
 * (defensive against legacy rows that pre-date a section kind).
 *
 * Rules:
 *   - Drop entries with unknown `type`
 *   - Drop duplicates — keep the FIRST occurrence so the
 *     agent's reordering is preserved
 *   - Always return cover first when present (the slide deck
 *     reads weirdly without one)
 */
export function normalizeSections(input: unknown): Section[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<SectionKind>();
  const out: Section[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const type = (item as { type?: unknown }).type;
    if (typeof type !== "string") continue;
    if (!isSectionKind(type)) continue;
    if (seen.has(type)) continue;
    seen.add(type);
    out.push({
      type,
      enabled: Boolean((item as { enabled?: unknown }).enabled ?? true),
      config:
        (item as { config?: Record<string, unknown> }).config &&
        typeof (item as { config?: unknown }).config === "object"
          ? ((item as { config: Record<string, unknown> }).config)
          : undefined,
    });
  }
  // Hoist cover to the front if present.
  const coverIdx = out.findIndex((s) => s.type === "cover");
  if (coverIdx > 0) {
    const [cover] = out.splice(coverIdx, 1);
    out.unshift(cover);
  }
  return out;
}

function isSectionKind(s: string): s is SectionKind {
  return (SECTION_KINDS as ReadonlyArray<string>).includes(s);
}

// ── Readiness predicate ─────────────────────────────────────────

export type ReadinessInput = {
  propertyAddress: string;
  suggestedListPrice: number | null;
  sections: ReadonlyArray<Section>;
  /** Set by callers that have already fetched related artifacts
   *  (CMA exists, testimonials exist, etc.). The predicate uses
   *  these to flag sections that are enabled but empty. */
  hasCmaData: boolean;
  hasTestimonials: boolean;
};

export type ReadinessResult = {
  ready: boolean;
  missing: ReadinessIssue[];
};

export type ReadinessIssue =
  | "no_address"
  | "no_list_price"
  | "no_sections_enabled"
  | "cma_enabled_but_empty"
  | "testimonials_enabled_but_empty";

/**
 * Decide whether a presentation is shippable. The agent dashboard
 * surfaces a "Ready to share" badge when this returns true; while
 * `missing` is non-empty it shows a checklist so they know what
 * to fix. Pure — vitest covers each branch.
 */
export function isPresentationReady(
  input: ReadinessInput,
): ReadinessResult {
  const missing: ReadinessIssue[] = [];

  if (!input.propertyAddress?.trim()) missing.push("no_address");
  if (input.suggestedListPrice == null || !Number.isFinite(input.suggestedListPrice)) {
    missing.push("no_list_price");
  }
  const enabled = input.sections.filter((s) => s.enabled);
  if (enabled.length === 0) {
    missing.push("no_sections_enabled");
  }

  const cmaEnabled = enabled.some((s) => s.type === "cma");
  if (cmaEnabled && !input.hasCmaData) missing.push("cma_enabled_but_empty");

  const testEnabled = enabled.some((s) => s.type === "testimonials");
  if (testEnabled && !input.hasTestimonials) {
    missing.push("testimonials_enabled_but_empty");
  }

  return { ready: missing.length === 0, missing };
}
