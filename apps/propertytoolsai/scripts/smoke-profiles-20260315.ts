/**
 * Verifies `public.profiles` from 20260315000000_create_profiles_table.sql.
 *
 * Usage (from repo root):
 *   npm run smoke:profiles-20260315 -w propertytoolsai
 *
 * Env: apps/propertytoolsai/.env.local:
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
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (check apps/propertytoolsai/.env.local)"
    );
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(url, key);

  console.log("Checking public.profiles (20260315000000_create_profiles_table)...\n");

  const { error, data } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, created_at, updated_at")
    .limit(1);

  if (error) {
    console.error(`✗ profiles: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  console.log("✓ profiles: table readable with baseline columns (id, email, full_name, role, created_at, updated_at)");
  if (data && data.length > 0) {
    console.log(`  sample row id: ${String((data[0] as { id: string }).id).slice(0, 8)}…`);
  } else {
    console.log("  (no rows yet — table exists and is queryable)");
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
