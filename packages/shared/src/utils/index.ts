/** Shared pure helpers (dates, formatting). Expand incrementally. */
export function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}
