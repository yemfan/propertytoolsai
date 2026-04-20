/**
 * Request validation for POST /api/revalidate.
 *
 * Pure logic — no Next.js or runtime deps — so the route handler stays thin
 * and the input rules can be exercised by vitest without spinning up Next.
 *
 * Security model: callers must send the shared secret in the
 * `x-revalidate-secret` header. The server compares with timing-safe equality
 * so mismatched secrets don't leak length via response time.
 *
 * Path rules:
 *  - must be a non-empty string
 *  - must start with "/"
 *  - must not contain ".." (rules out traversal-style inputs)
 *  - must be ≤ 500 chars (arbitrary guard against accidental payload bloat)
 *  - duplicates within a single request are de-duped before the caller sees them
 */

import { timingSafeEqual } from "node:crypto";

export const MAX_PATH_LEN = 500;
export const MAX_PATHS_PER_REQUEST = 50;

export type ValidatedPaths =
  | { ok: true; paths: string[] }
  | { ok: false; status: 400 | 401 | 413; error: string };

/** Timing-safe string equality. Returns false for any length mismatch or non-string input. */
export function secretsMatch(provided: unknown, expected: string | undefined): boolean {
  if (typeof provided !== "string" || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function isValidPath(p: unknown): p is string {
  return (
    typeof p === "string" &&
    p.length > 0 &&
    p.length <= MAX_PATH_LEN &&
    p.startsWith("/") &&
    !p.includes("..")
  );
}

export function parseRevalidateBody(body: unknown): ValidatedPaths {
  if (!body || typeof body !== "object") {
    return { ok: false, status: 400, error: "Body must be a JSON object." };
  }

  const record = body as Record<string, unknown>;

  let raw: unknown[];
  if (Array.isArray(record.paths)) {
    raw = record.paths;
  } else if (typeof record.path === "string") {
    raw = [record.path];
  } else {
    return {
      ok: false,
      status: 400,
      error: 'Expected { "paths": string[] } or { "path": string }.',
    };
  }

  if (raw.length === 0) {
    return { ok: false, status: 400, error: "Provide at least one path." };
  }

  if (raw.length > MAX_PATHS_PER_REQUEST) {
    return {
      ok: false,
      status: 413,
      error: `Too many paths (max ${MAX_PATHS_PER_REQUEST}).`,
    };
  }

  const bad = raw.find((p) => !isValidPath(p));
  if (bad !== undefined) {
    return {
      ok: false,
      status: 400,
      error: `Invalid path: ${JSON.stringify(bad).slice(0, 80)}`,
    };
  }

  const deduped = Array.from(new Set(raw as string[]));
  return { ok: true, paths: deduped };
}
