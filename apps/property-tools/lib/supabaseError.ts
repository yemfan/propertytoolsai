/**
 * Supabase/PostgREST sometimes returns error objects with an empty `message`,
 * which surfaces in Next as `Error: {"message":""}`. Normalize to a real message.
 */
export function toErrorFromSupabase(err: unknown, fallback: string): Error {
  if (err instanceof Error && err.message.trim()) {
    return err;
  }
  const o = err as {
    message?: string;
    code?: string;
    details?: string;
    hint?: string;
  };
  const parts = [o.code, o.message, o.details, o.hint]
    .map((x) => String(x ?? "").trim())
    .filter(Boolean);
  if (parts.length) {
    return new Error(parts.join(" — "));
  }
  try {
    const j = JSON.stringify(err);
    // PostgREST often returns `{ message: "" }` with no code — avoid noisy useless errors.
    if (j && j !== "{}" && j !== "null" && j !== '{"message":""}') {
      return new Error(`${fallback}: ${j}`);
    }
  } catch {
    /* ignore */
  }
  return new Error(fallback);
}
