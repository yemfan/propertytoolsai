/**
 * Verifies billing_subscriptions, product entitlements, usage, and related view/RPC.
 *
 * Usage:
 *   npm run smoke:billing-entitlements -w leadsmartai
 *
 * Env: apps/leadsmartai/.env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (check apps/leadsmartai/.env.local)"
    );
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(url, key);

  console.log("Checking billing + entitlements migrations…\n");

  const { error: billingErr } = await supabase
    .from("billing_subscriptions")
    .select("id,user_id,plan,status")
    .limit(1);
  if (billingErr) {
    console.error(`✗ billing_subscriptions: ${billingErr.message}`);
    process.exitCode = 1;
    return;
  }
  console.log("✓ billing_subscriptions");

  const { error: peErr } = await supabase
    .from("product_entitlements")
    .select("id,user_id,product,plan,is_active")
    .limit(1);
  if (peErr) {
    console.error(`✗ product_entitlements: ${peErr.message}`);
    process.exitCode = 1;
    return;
  }
  console.log("✓ product_entitlements");

  const { error: usageErr } = await supabase
    .from("entitlement_usage_daily")
    .select("id,user_id,product,usage_date")
    .limit(1);
  if (usageErr) {
    console.error(`✗ entitlement_usage_daily: ${usageErr.message}`);
    process.exitCode = 1;
    return;
  }
  console.log("✓ entitlement_usage_daily");

  const { error: viewErr } = await supabase
    .from("active_product_entitlements")
    .select("id,user_id,product,plan,is_active")
    .limit(1);
  if (viewErr) {
    console.error(`✗ active_product_entitlements (view): ${viewErr.message}`);
    process.exitCode = 1;
    return;
  }
  console.log("✓ active_product_entitlements (view)");

  const nil = "00000000-0000-0000-0000-000000000000";
  const { error: rpcErr } = await supabase.rpc("get_active_agent_entitlement", {
    p_user_id: nil,
  });
  if (rpcErr) {
    console.error(`✗ get_active_agent_entitlement(uuid): ${rpcErr.message}`);
    process.exitCode = 1;
    return;
  }
  console.log("✓ get_active_agent_entitlement (rpc)");

  console.log("\n✓ Billing + entitlements schema smoke passed.\n");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
