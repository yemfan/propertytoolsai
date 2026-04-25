import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { isSalesModelId, type SalesModelId } from "./sales-models";

/**
 * Server-side helpers for the Sales Model selection.
 *
 * Reads / writes the `agent_profiles.sales_model` column. Used by:
 *   - `/api/sales-model` route handlers (GET / PUT)
 *   - `/dashboard/sales-model/page.tsx` (initial render)
 *   - `/dashboard/sales-model/onboarding/page.tsx` (gate check)
 *
 * All access is via `supabaseAdmin` (service role) — the route
 * handler validates the user's session before invoking these.
 *
 * Idempotent: `saveSelectedSalesModelServer` upserts on `user_id`,
 * so calling it repeatedly with the same model doesn't churn rows.
 */

export async function getSelectedSalesModelServer(
  userId: string,
): Promise<SalesModelId | null> {
  const { data, error } = await supabaseAdmin
    .from("agent_profiles")
    .select("sales_model")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[sales-model] getSelectedSalesModelServer:", error.message);
    return null;
  }
  const value = (data as { sales_model?: string } | null)?.sales_model;
  return typeof value === "string" && isSalesModelId(value) ? value : null;
}

export async function saveSelectedSalesModelServer(
  userId: string,
  model: SalesModelId,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const nowIso = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("agent_profiles")
    .upsert(
      {
        user_id: userId,
        sales_model: model,
        sales_model_updated_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: "user_id" },
    );
  if (error) {
    console.error("[sales-model] saveSelectedSalesModelServer:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
