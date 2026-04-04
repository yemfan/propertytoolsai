/**
 * Verifies canonical user split: user_profiles (contact + signup_origin) vs
 * leadsmart_users (RBAC/billing) vs propertytools_users (tier).
 *
 * Usage (repo root): pnpm run smoke:user-profiles-canonical -w leadsmartai
 *
 * Env: apps/leadsmartai/.env.local — NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
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
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (.env.local)");
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(url, key);
  console.log("Canonical user_profiles / leadsmart_users / propertytools_users…\n");

  const { error: up } = await supabase
    .from("user_profiles")
    .select("user_id,full_name,email,phone,avatar_url,signup_origin_app,is_active,created_at")
    .limit(1);
  if (up) {
    console.error(`✗ user_profiles (canonical contact + signup_origin_app): ${up.message}`);
    process.exitCode = 1;
    return;
  }
  console.log("✓ user_profiles: contact + signup_origin_app (no legacy plan/role on this row)");

  const { error: ls } = await supabase
    .from("leadsmart_users")
    .select("user_id,role,plan,tokens_remaining,oauth_onboarding_completed,trial_used,estimator_usage_count,cma_usage_count")
    .limit(1);
  if (ls) {
    console.error(`✗ leadsmart_users (RBAC + billing): ${ls.message}`);
    process.exitCode = 1;
    return;
  }
  console.log("✓ leadsmart_users: role, plan, tokens, trials, usage counters");

  const { error: pt } = await supabase.from("propertytools_users").select("user_id,tier").limit(1);
  if (pt) {
    console.error(`✗ propertytools_users: ${pt.message}`);
    process.exitCode = 1;
    return;
  }
  console.log("✓ propertytools_users: tier");

  const { error: nested } = await supabase
    .from("user_profiles")
    .select("user_id,leadsmart_users(role,plan),propertytools_users(tier)")
    .limit(1);
  if (nested) {
    console.error(`✗ PostgREST nested user_profiles → leadsmart_users / propertytools_users: ${nested.message}`);
    process.exitCode = 1;
    return;
  }
  console.log("✓ Nested select (app pattern): user_profiles + leadsmart_users + propertytools_users");

  console.log("\nAll canonical user schema checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
