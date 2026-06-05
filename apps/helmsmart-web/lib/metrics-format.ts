/**
 * Pure metric-formatting helpers shared by the business-insights generator.
 * Kept in its own module (no Anthropic / Supabase imports) so it can be
 * unit-tested without instantiating heavy clients.
 */

/**
 * Format a week-over-week change as a signed percentage string.
 * Edge cases the digest prompt relies on:
 *   - prev === 0 && now > 0  → "new"   (can't divide; it's brand-new activity)
 *   - prev === 0 && now <= 0 → "flat"  (nothing then, nothing now)
 *   - otherwise              → "+N%" / "-N%" (rounded to whole percent)
 */
export function pctChange(now: number, prev: number): string {
  if (prev === 0) return now > 0 ? "new" : "flat";
  const pct = ((now - prev) / prev) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(0)}%`;
}
