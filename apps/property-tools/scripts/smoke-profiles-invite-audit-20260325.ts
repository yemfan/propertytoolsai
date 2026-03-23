/**
 * Verifies `invited_by` / `invited_at` on `public.profiles` from
 * 20260325000000_profiles_invite_audit.sql.
 *
 * Usage (from repo root):
 *   npm run smoke:profiles-invite-audit-20260325 -w property-tools
 *
 * Env: apps/property-tools/.env.local:
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
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (check apps/property-tools/.env.local)"
    );
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(url, key);

  console.log("Checking public.profiles invite audit columns (20260325000000_profiles_invite_audit)...\n");

  const { error, data } = await supabase
    .from("profiles")
    .select("id, invited_by, invited_at")
    .limit(1);

  if (error) {
    console.error(`✗ profiles (invited_by, invited_at): ${error.message}`);
    process.exitCode = 1;
    return;
  }

  console.log("✓ profiles: invited_by, invited_at columns readable");
  if (data && data.length > 0) {
    const row = data[0] as { id: string; invited_by: string | null; invited_at: string | null };
    console.log(`  sample id: ${String(row.id).slice(0, 8)}… invited_by: ${row.invited_by ?? "null"} invited_at: ${row.invited_at ?? "null"}`);
  } else {
    console.log("  (no rows — columns exist and are queryable)");
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
