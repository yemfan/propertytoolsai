/**
 * Verifies 20260320_lead_marketplace_system.sql: tables, leads columns, helper RPCs.
 *
 * Usage (from repo root):
 *   npm run smoke:lead-marketplace -w leadsmartai
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

  console.log("Checking lead marketplace migration (20260320_lead_marketplace_system)...\n");

  const tables: { table: string; select: string }[] = [
    { table: "tool_usage_logs", select: "id" },
    { table: "opportunities", select: "id" },
  ];

  for (const { table, select } of tables) {
    const { error } = await supabase.from(table).select(select).limit(1);
    if (error) {
      console.error(`✗ ${table}: ${error.message}`);
      process.exitCode = 1;
      return;
    }
    console.log(`✓ ${table}: OK (readable)`);
  }

  const { error: leadsErr } = await supabase
    .from("contacts")
    .select("id,lead_type,contact_info,marketplace_opportunity_id")
    .limit(1);
  if (leadsErr) {
    console.error(`✗ leads marketplace columns: ${leadsErr.message}`);
    process.exitCode = 1;
    return;
  }
  console.log("✓ leads: lead_type, contact_info, marketplace_opportunity_id OK");

  const map = await supabase.rpc("marketplace_map_tool_to_lead_type", { p_tool_name: "cma" });
  if (map.error) {
    console.error(`✗ marketplace_map_tool_to_lead_type: ${map.error.message}`);
    process.exitCode = 1;
    return;
  }
  if (String(map.data) !== "seller") {
    console.error(`✗ marketplace_map_tool_to_lead_type: expected 'seller', got ${JSON.stringify(map.data)}`);
    process.exitCode = 1;
    return;
  }
  console.log("✓ RPC marketplace_map_tool_to_lead_type('cma') → seller");

  const score = await supabase.rpc("marketplace_compute_intent_score", {
    p_usage_count: 2,
    p_action: "submit",
  });
  if (score.error) {
    console.error(`✗ marketplace_compute_intent_score: ${score.error.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`✓ RPC marketplace_compute_intent_score → ${JSON.stringify(score.data)}`);

  const price = await supabase.rpc("marketplace_compute_price", {
    p_intent_score: 80,
    p_estimated_value: 1200000,
    p_usage_count: 4,
  });
  if (price.error) {
    console.error(`✗ marketplace_compute_price: ${price.error.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`✓ RPC marketplace_compute_price → ${JSON.stringify(price.data)}`);

  console.log("\nLead marketplace migration is present and queryable.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
