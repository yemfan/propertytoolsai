/**
 * Verifies key objects from 20260319_* migrations (after bundle or individual files).
 *
 * Usage (from repo root):
 *   npm run smoke:20260319-schema -w leadsmartai
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

  console.log("Checking 20260319 schema (usage, CMA daily, tasks, daily_briefings)...\n");

  const { error: up } = await supabase.from("user_profiles").select("user_id,phone").limit(1);
  if (up) {
    console.error(`✗ user_profiles (contact): ${up.message}`);
    process.exitCode = 1;
    return;
  }
  console.log("✓ user_profiles: phone (trial/usage live on leadsmart_users after split)");

  const { error: lsUsage } = await supabase
    .from("leadsmart_users")
    .select("user_id,trial_used,estimator_usage_count,cma_usage_count")
    .limit(1);
  if (lsUsage) {
    console.error(`✗ leadsmart_users (trial + usage counters): ${lsUsage.message}`);
    process.exitCode = 1;
    return;
  }
  console.log("✓ leadsmart_users: trial_used, estimator/cma usage");

  const { error: leads } = await supabase
    .from("leads")
    .select("id,stage,source,email")
    .limit(1);
  if (leads) {
    console.error(`✗ leads progressive columns: ${leads.message}`);
    process.exitCode = 1;
    return;
  }
  console.log("✓ leads: progressive capture columns");

  const { error: cma } = await supabase.from("cma_daily_usage").select("subject_key").limit(1);
  if (cma) {
    console.error(`✗ cma_daily_usage: ${cma.message}`);
    process.exitCode = 1;
    return;
  }
  console.log("✓ cma_daily_usage");

  const { error: tasks } = await supabase.from("tasks").select("id,agent_id,due_date").limit(1);
  if (tasks) {
    console.error(`✗ tasks: ${tasks.message}`);
    process.exitCode = 1;
    return;
  }
  console.log("✓ tasks");

  const { error: db } = await supabase.from("daily_briefings").select("id,agent_id,summary,created_at").limit(1);
  if (db) {
    console.error(`✗ daily_briefings: ${db.message}`);
    process.exitCode = 1;
    return;
  }
  console.log("✓ daily_briefings (agent_id compatible with your agents.id type)");

  console.log("\n20260319 schema checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
