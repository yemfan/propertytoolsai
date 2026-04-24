import "server-only";

import { PRODUCT_LEADSMART_AGENT } from "./product";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Idempotently ensure a user has an active LeadSmart AI Agent Starter
 * entitlement + a matching "free tier, active" state on the user row.
 *
 * Called from the dashboard layout when we detect an inactive
 * subscription — instead of trapping the user on a billing page, we
 * drop them onto the free tier so they can continue using the app.
 *
 * Idempotent:
 *   - If the user already has any active product_entitlements row
 *     (starter / growth / elite / paid), we don't touch it. No-op.
 *   - If they have an inactive row (expired trial, cancelled), we
 *     deactivate it and insert a fresh Starter row.
 *   - leadsmart_users.subscription_status gets set to "active" and
 *     plan to "free" so the dashboard layout's sub check lets them
 *     through next time.
 *
 * Returns true if we actually changed state, false if already-good.
 */
export async function ensureStarterEntitlement(
  userId: string,
): Promise<{ changed: boolean; reason: string }> {
  const now = new Date().toISOString();

  // 1. Short-circuit if any active entitlement already exists. We only
  // drop a user onto Starter if they have *no* active plan. An expired
  // paid customer should never silently become a free-tier customer.
  const { data: activeRow } = await supabaseAdmin
    .from("product_entitlements")
    .select("id, plan")
    .eq("user_id", userId)
    .eq("product", PRODUCT_LEADSMART_AGENT)
    .eq("is_active", true)
    .maybeSingle();

  if (activeRow) {
    // They have some active plan — the inactive subscription_status
    // was probably stale. Sync the user row so the gate stops tripping.
    await syncUserRowToActive(userId, activeRow as { plan: string } | null);
    return { changed: true, reason: "synced stale user row" };
  }

  // 2. Deactivate any prior (inactive) rows, then insert fresh Starter.
  await supabaseAdmin
    .from("product_entitlements")
    .update({ is_active: false, updated_at: now })
    .eq("user_id", userId)
    .eq("product", PRODUCT_LEADSMART_AGENT);

  const { error: insertErr } = await supabaseAdmin
    .from("product_entitlements")
    .insert({
      user_id: userId,
      product: PRODUCT_LEADSMART_AGENT,
      plan: "starter",
      is_active: true,
      cma_reports_per_day: 2,
      max_leads: 5,
      max_contacts: 50,
      alerts_level: "basic",
      reports_download_level: "limited",
      team_access: false,
      source: "auto_starter_on_inactive",
      starts_at: now,
      updated_at: now,
    });

  if (insertErr) {
    console.error("[ensureStarterEntitlement] insert failed:", insertErr);
    throw insertErr;
  }

  await syncUserRowToActive(userId, { plan: "starter" });

  return { changed: true, reason: "assigned starter" };
}

/**
 * Keep `leadsmart_users.subscription_status` + `plan` consistent with
 * the chosen entitlement so the dashboard layout's gate stops
 * bouncing them.
 */
async function syncUserRowToActive(
  userId: string,
  entitlement: { plan: string } | null,
): Promise<void> {
  const plan = entitlement?.plan ?? "starter";
  const uiPlan = plan === "starter" ? "free" : plan; // leadsmart_users.plan uses "free" for starter
  await supabaseAdmin
    .from("leadsmart_users")
    .update({
      plan: uiPlan,
      subscription_status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}
