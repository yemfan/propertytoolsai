import type { CmaSnapshot } from "./types";

/**
 * Pure projection from a CMA snapshot to the denormalized columns the
 * `cma_reports` table caches for fast list-view sort/filter without
 * having to parse JSON. Lives in its own file (no `server-only`) so
 * vitest can hit it without the supabase admin shim.
 */
export type DenormalizedCma = {
  estimatedValue: number | null;
  lowEstimate: number | null;
  highEstimate: number | null;
  confidenceScore: number | null;
  compCount: number;
};

export function denormalize(snapshot: CmaSnapshot): DenormalizedCma {
  const v = snapshot.valuation;
  return {
    estimatedValue: numericOrNull(v?.estimatedValue ?? null),
    lowEstimate: numericOrNull(v?.low ?? null),
    highEstimate: numericOrNull(v?.high ?? null),
    confidenceScore:
      typeof v?.confidenceScore === "number" ? v.confidenceScore : null,
    compCount: Array.isArray(snapshot.comps) ? snapshot.comps.length : 0,
  };
}

function numericOrNull(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
