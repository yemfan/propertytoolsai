/**
 * `redirect()` throws an internal error that must be rethrown from catch blocks.
 *
 * Do not import from `next/dist/client/*` here — dashboard Server Components use
 * this helper and that deep import can break production RSC bundling.
 *
 * Logic aligned with `next/dist/client/components/redirect-error` (digest shape).
 */
const REDIRECT_ERROR_CODE = "NEXT_REDIRECT";
const REDIRECT_STATUS_CODES = new Set([303, 307, 308]);

export function isRedirectError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return false;
  }
  const digest = (error as { digest: unknown }).digest;
  if (typeof digest !== "string") return false;

  const parts = digest.split(";");
  const [errorCode, type] = parts;
  const destination = parts.slice(2, -2).join(";");
  const statusRaw = parts.at(-2);
  const statusCode = Number(statusRaw);

  return (
    errorCode === REDIRECT_ERROR_CODE &&
    (type === "replace" || type === "push") &&
    typeof destination === "string" &&
    !Number.isNaN(statusCode) &&
    REDIRECT_STATUS_CODES.has(statusCode)
  );
}
