import "server-only";

/**
 * Helpers for the `contact_scores` table.
 *
 * The table's actual prod shape is:
 *
 *   id          uuid       (gen_random_uuid)
 *   contact_id  uuid       (FK contacts.id)
 *   agent_id    bigint     NOT NULL  (FK agents.id)
 *   score       numeric    NOT NULL
 *   label       text       NULLABLE
 *   factors     jsonb      NOT NULL  default '{}'
 *   model_version  text    NULLABLE
 *   computed_at timestamptz NOT NULL default now()
 *
 * The original Phase-1 design had top-level columns for
 * `intent / timeline / confidence / explanation`. Those never
 * landed in prod — the schema shipped with a flexible `factors`
 * JSONB blob instead. Multiple call sites missed that pivot and
 * kept reading / writing the non-existent columns, which:
 *   - Made every contact_scores SELECT silently return null for
 *     all derived fields (the destructure `{ data }` swallows the
 *     "column does not exist" error)
 *   - Made every INSERT 500 (also wrapped in destructures, so
 *     callers carried on as if the row had been written)
 *
 * This helper centralizes the read + write so a single source of
 * truth picks the right columns. Future callers should import
 * `unpackScoreRow` and `serializeScoreRow` rather than rolling
 * their own SELECT / INSERT strings.
 */

/** Columns to SELECT from contact_scores. Don't add `intent`,
 *  `timeline`, `confidence`, `explanation`, or `updated_at` — those
 *  aren't real columns; they live inside `factors`. */
export const CONTACT_SCORES_SELECT =
  "contact_id,score,label,factors,computed_at";

export type UnpackedContactScore = {
  /** Numeric lead score. */
  score: number;
  /** Categorical label (e.g. "hot" / "warm"). */
  label: string | null;
  intent: string | null;
  timeline: string | null;
  confidence: number | null;
  explanation: string[];
  /** When the score was computed (defaults to row insert time). */
  computedAt: string | null;
};

/**
 * Coerce a contact_scores row into the normalized shape consumers
 * expect. Tolerates missing columns / missing factor keys / wrong
 * types — returns sensible nulls in those cases so a single bad
 * row doesn't 500 the whole list-hydration path.
 */
export function unpackScoreRow(
  row: Record<string, unknown> | null | undefined,
): UnpackedContactScore | null {
  if (!row) return null;
  const factors =
    (row.factors as Record<string, unknown> | null | undefined) ?? {};
  const score = Number(row.score ?? 0);
  return {
    score: Number.isFinite(score) ? score : 0,
    label: typeof row.label === "string" ? row.label : null,
    intent: typeof factors.intent === "string" ? factors.intent : null,
    timeline:
      typeof factors.timeline === "string" ? factors.timeline : null,
    confidence:
      factors.confidence != null && Number.isFinite(Number(factors.confidence))
        ? Number(factors.confidence)
        : null,
    explanation: Array.isArray(factors.explanation)
      ? (factors.explanation as unknown[]).filter(
          (e): e is string => typeof e === "string",
        )
      : [],
    computedAt:
      typeof row.computed_at === "string" ? row.computed_at : null,
  };
}

/**
 * Build a contact_scores INSERT payload from a logical score
 * result. `factors` always gets the AI-derived blob; the table's
 * agent_id is NOT NULL so the caller MUST pass one.
 */
export function serializeScoreRow(input: {
  contactId: string;
  agentId: number | string;
  score: number;
  intent: string;
  timeline: string;
  confidence: number;
  explanation: string[];
  label?: string | null;
  modelVersion?: string | null;
}): Record<string, unknown> {
  return {
    contact_id: input.contactId,
    agent_id:
      typeof input.agentId === "string"
        ? Number(input.agentId)
        : input.agentId,
    score: input.score,
    label: input.label ?? null,
    factors: {
      intent: input.intent,
      timeline: input.timeline,
      confidence: input.confidence,
      explanation: input.explanation,
    },
    model_version: input.modelVersion ?? null,
    // computed_at defaults to now() in the schema; omit so we don't
    // race the DB clock.
  };
}
