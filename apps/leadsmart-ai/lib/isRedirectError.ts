/**
 * `redirect()` throws an internal error that must be rethrown from catch blocks.
 * Use Next.js implementation so digest format stays in sync across versions.
 */
export { isRedirectError } from "next/dist/client/components/redirect-error";
