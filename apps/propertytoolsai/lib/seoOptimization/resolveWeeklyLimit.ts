/**
 * Batch size for SEO weekly optimization (`GET /api/cron/seo-content-optimization`, `runWeeklyBatch`).
 * Query `limit` overrides `SEO_OPT_WEEKLY_LIMIT` when present and positive.
 * Returns 0 when disabled (no batch run).
 */
export function resolveWeeklyBatchLimit(
  queryLimit: string | null,
  envWeeklyLimit: string | undefined
): number {
  if (queryLimit !== null && queryLimit.trim() !== "") {
    const n = Number(queryLimit);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }
  const env = Number(envWeeklyLimit ?? "0");
  return Number.isFinite(env) && env > 0 ? Math.floor(env) : 0;
}
