/**
 * `redirect()` throws an internal error that must be rethrown from catch blocks.
 * `next/navigation` does not export `isRedirectError` in Next.js 16 (TypeScript build fails).
 */
export function isRedirectError(error: unknown): boolean {
  if (error === null || typeof error !== "object") return false;
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}
