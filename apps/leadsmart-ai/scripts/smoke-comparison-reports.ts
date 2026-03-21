/**
 * Verifies 20260328_comparison_reports.sql (comparison_reports table).
 *
 * Usage (from repo root):
 *   npm run smoke:comparison-reports -w leadsmart-ai
 *
 * Env: apps/leadsmart-ai/.env.local:
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
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (check apps/leadsmart-ai/.env.local)"
    );
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(url, key);

  console.log("Checking comparison reports migration (20260328_comparison_reports)...\n");

  const { error } = await supabase
    .from("comparison_reports")
    .select("id,agent_id,client_name,properties,result,created_at")
    .limit(1);

  if (error) {
    console.error(`✗ comparison_reports: ${error.message}`);
    if (/relation|does not exist|schema cache/i.test(error.message)) {
      console.error("  → Table missing or PostgREST cache stale.");
    }
    process.exitCode = 1;
    return;
  }

  console.log("✓ comparison_reports: OK (readable)");
  console.log("\nComparison reports migration is present and queryable.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
