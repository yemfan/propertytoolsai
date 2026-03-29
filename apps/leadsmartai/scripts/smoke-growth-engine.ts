/**
 * Verifies 20260331_growth_engine.sql tables exist and are readable with service role.
 *
 * Usage (from repo root):
 *   npm run smoke:growth-engine -w leadsmartai
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

const CHECKS: { table: string; select: string }[] = [
  { table: "shareable_results", select: "id" },
  { table: "referral_codes", select: "code" },
  { table: "referral_events", select: "id" },
];

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

  console.log("Checking growth engine tables (migration 20260331_growth_engine)...\n");

  for (const { table, select } of CHECKS) {
    const { error } = await supabase.from(table).select(select).limit(1);
    if (error) {
      console.error(`✗ ${table}: ${error.message}`);
      if (/relation|does not exist|schema cache/i.test(error.message)) {
        console.error("  → Table missing or PostgREST cache stale. Re-run migration or reload schema.");
      }
      process.exitCode = 1;
      return;
    }
    console.log(`✓ ${table}: OK (readable)`);
  }

  console.log("\nAll growth engine tables are present and queryable.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
