/**
 * Verifies 20260330_client_portal.sql tables exist and are readable with service role.
 *
 * Usage (from repo root):
 *   npm run smoke:client-portal -w leadsmartai
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

const TABLES = [
  "client_portal_messages",
  "client_saved_homes",
  "client_portal_documents",
] as const;

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

  console.log("Checking client portal tables (migration 20260330_client_portal)...\n");

  for (const table of TABLES) {
    const { error } = await supabase.from(table).select("id").limit(1);
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

  console.log("\nAll client portal tables are present and queryable.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
