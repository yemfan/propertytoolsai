/**
 * Request validation for POST /api/revalidate.
 *
 * Pure logic — no Next.js or runtime deps — so the route handler stays thin
 * and the input rules can be exercised by vitest without spinning up Next.
 *
 * Validation failures throw `RevalidateValidationError` carrying the HTTP
 * status the caller should return, which keeps the route handler's happy
 * path free of discriminated-union narrowing (Next 16 / turbopack TS check
 * wasn't narrowing a union with `ok: true | false` reliably, so we use an
 * explicit thrown error instead).
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

export type ValidationStatus = 400 | 401 | 413;

export class RevalidateValidationError extends Error {
  readonly status: ValidationStatus;
  constructor(status: ValidationStatus, message: string) {
    super(message);
    this.name = "RevalidateValidationError";
    this.status = status;
  }
}

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

/**
 * Parse + validate a POST body for /api/revalidate. Returns the de-duped
 * list of paths; throws `RevalidateValidationError` on invalid input.
 */
export function parseRevalidateBody(body: unknown): string[] {
  if (!body || typeof body !== "object") {
    throw new RevalidateValidationError(400, "Body must be a JSON object.");
  }

  const record = body as Record<string, unknown>;

  let raw: unknown[];
  if (Array.isArray(record.paths)) {
    raw = record.paths;
  } else if (typeof record.path === "string") {
    raw = [record.path];
  } else {
    throw new RevalidateValidationError(
      400,
      'Expected { "paths": string[] } or { "path": string }.',
    );
  }

  if (raw.length === 0) {
    throw new RevalidateValidationError(400, "Provide at least one path.");
  }

  if (raw.length > MAX_PATHS_PER_REQUEST) {
    throw new RevalidateValidationError(
      413,
      `Too many paths (max ${MAX_PATHS_PER_REQUEST}).`,
    );
  }

  const bad = raw.find((p) => !isValidPath(p));
  if (bad !== undefined) {
    throw new RevalidateValidationError(
      400,
      `Invalid path: ${JSON.stringify(bad).slice(0, 80)}`,
    );
  }

  return Array.from(new Set(raw as string[]));
}
