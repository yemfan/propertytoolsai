/**
 * Storage abstraction for the Sales Model selection.
 *
 * Two backends, one API:
 *
 *   1. **Supabase** (`agent_profiles.sales_model`) — used everywhere
 *      in production. Server actions and API routes call the server
 *      helpers below; they hit Supabase via the user's session.
 *
 *   2. **localStorage** — dev fallback for client components running
 *      without a logged-in session, and for tests. Same key shape so
 *      a future "import local pick into account" flow stays cheap.
 *
 * The two surfaces are deliberately split:
 *   - `getSelectedSalesModelServer` / `saveSelectedSalesModelServer` —
 *     callable from server components, route handlers, server actions.
 *     Marked `"server-only"` so they can't accidentally leak the
 *     service-role client into client bundles.
 *   - `readLocalSalesModel` / `writeLocalSalesModel` — client-only
 *     localStorage shims. Safe to call from `"use client"` components.
 *
 * The unified helpers (`getSelectedSalesModel`, `saveSelectedSalesModel`,
 * `updateSelectedSalesModel`) live in this file's `client.ts`-style
 * named exports below — they accept a `userId` so test code can swap
 * in a stable id, and gracefully fall back to localStorage when
 * Supabase isn't configured.
 */

import { isSalesModelId, type SalesModelId } from "./sales-models";

// ── localStorage (client-only) ────────────────────────────────────

const LS_KEY = "leadsmart.salesModel.v1";

/**
 * Reads the locally-stored sales model. Returns `null` when nothing
 * is stored, when the value is malformed, or when called server-side.
 *
 * Safe to call from server-render paths — `typeof window` guard makes
 * it a no-op there.
 */
export function readLocalSalesModel(): SalesModelId | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return isSalesModelId(raw) ? raw : null;
  } catch {
    // localStorage can throw in private windows / quota errors. Fail
    // open — the caller treats null as "not set yet".
    return null;
  }
}

/**
 * Persists the sales model to localStorage. No-op server-side.
 *
 * The optimistic UI updates (onboarding card click, switch-model
 * confirm) call this immediately so the next page paint reflects the
 * choice without waiting for the round-trip to Supabase.
 */
export function writeLocalSalesModel(model: SalesModelId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEY, model);
  } catch {
    // Ignore — quota / private window. The server-side write is the
    // source of truth; localStorage is just a perceptual cache.
  }
}

export function clearLocalSalesModel(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LS_KEY);
  } catch {
    // Ignore.
  }
}

// ── Unified API (callable from anywhere) ──────────────────────────
//
// These wrap the API route + localStorage so callers don't have to
// branch on environment. Use these from client components.

/**
 * Read the agent's current sales model. Tries the server (via the API
 * route) first; on any failure or 401, falls back to localStorage.
 *
 * Returns `null` when nothing is set anywhere — the caller decides
 * whether to redirect to onboarding or fall through to a default.
 */
export async function getSelectedSalesModel(
  _userId?: string,
): Promise<SalesModelId | null> {
  // The API route uses the user's session cookie — no need to thread
  // userId through manually. The arg stays in the signature so test
  // doubles can pretend-fetch by id and so we can move to a userId-
  // keyed cache later without breaking callers.
  void _userId;
  if (typeof window === "undefined") {
    // On the server, reading should go through the server-side
    // helpers (see API route). Don't try to fetch our own URL here —
    // the page that needs the value should resolve it directly.
    return null;
  }
  try {
    const res = await fetch("/api/sales-model", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    if (res.ok) {
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        salesModel?: string | null;
      } | null;
      const sm = json?.salesModel;
      if (typeof sm === "string" && isSalesModelId(sm)) return sm;
    }
  } catch {
    // Network / parse error — fall through to local cache.
  }
  return readLocalSalesModel();
}

/**
 * Persist the agent's sales model. Updates localStorage first
 * (optimistic — instant UI), then PUTs to the API route so the
 * server-side row reflects the choice for next-load and for any
 * server component that reads it via `getSelectedSalesModelServer`.
 *
 * Returns true when both the local + server writes succeed. False
 * when the server write fails — the local copy still reflects the
 * pick so the agent isn't stuck, and the next save attempt will
 * retry from the same UI.
 */
export async function saveSelectedSalesModel(
  _userId: string | undefined,
  model: SalesModelId,
): Promise<boolean> {
  void _userId;
  writeLocalSalesModel(model);
  if (typeof window === "undefined") return false;
  try {
    const res = await fetch("/api/sales-model", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ salesModel: model }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Same wire as `saveSelectedSalesModel` but named to read better at
 * the call site for the "switch model" confirm flow. The semantic
 * difference is purely intent — both persist the same way.
 */
export async function updateSelectedSalesModel(
  userId: string | undefined,
  model: SalesModelId,
): Promise<boolean> {
  return saveSelectedSalesModel(userId, model);
}
