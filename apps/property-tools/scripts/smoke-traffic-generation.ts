/**
 * Verifies 20260325_traffic_generation_system.sql (leads traffic fields + traffic_events).
 *
 * Usage (from repo root):
 *   npm run smoke:traffic-generation -w property-tools
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

  console.log("Checking traffic generation migration (20260325_traffic_generation_system)...\n");

  const { error: leadsErr } = await supabase
    .from("leads")
    .select("id,traffic_source,lead_quality")
    .limit(1);
  if (leadsErr) {
    console.error(`✗ leads (traffic_source, lead_quality): ${leadsErr.message}`);
    process.exitCode = 1;
    return;
  }
  console.log("✓ leads: traffic_source, lead_quality OK");

  const { error: evErr } = await supabase
    .from("traffic_events")
    .select("id,event_type,page_path,city,source,campaign,lead_id,metadata,created_at")
    .limit(1);
  if (evErr) {
    console.error(`✗ traffic_events: ${evErr.message}`);
    if (/relation|does not exist|schema cache/i.test(evErr.message)) {
      console.error("  → Table missing or PostgREST cache stale.");
    }
    process.exitCode = 1;
    return;
  }
  console.log("✓ traffic_events: OK (readable)");

  console.log("\nTraffic generation migration is present and queryable.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
