/**
 * Verifies 20260321_auto_lead_nurturing_system.sql applied: tables + leads.nurture_score.
 *
 * Usage (from repo root):
 *   npm run smoke:lead-nurturing -w leadsmartai
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

const TABLES: { table: string; select: string }[] = [
  { table: "message_templates", select: "id" },
  { table: "lead_sequences", select: "id" },
  { table: "sequence_steps", select: "id" },
  { table: "message_logs", select: "id" },
  { table: "nurture_alerts", select: "id" },
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

  console.log("Checking auto lead nurturing migration (20260321_auto_lead_nurturing_system)...\n");

  for (const { table, select } of TABLES) {
    const { error } = await supabase.from(table).select(select).limit(1);
    if (error) {
      console.error(`✗ ${table}: ${error.message}`);
      if (/relation|does not exist|schema cache/i.test(error.message)) {
        console.error("  → Table missing or PostgREST cache stale.");
      }
      process.exitCode = 1;
      return;
    }
    console.log(`✓ ${table}: OK (readable)`);
  }

  const { error: leadsErr } = await supabase.from("leads").select("id,nurture_score").limit(1);
  if (leadsErr) {
    console.error(`✗ leads.nurture_score: ${leadsErr.message}`);
    process.exitCode = 1;
    return;
  }
  console.log("✓ leads: nurture_score column OK (readable)");

  const { data: fnTest, error: rpcErr } = await supabase.rpc("marketplace_apply_nurture_score", {
    p_lead_id: null,
    p_delta: 0,
  });
  if (rpcErr) {
    console.error(`✗ RPC marketplace_apply_nurture_score: ${rpcErr.message}`);
    process.exitCode = 1;
    return;
  }
  const fn = fnTest as { ok?: boolean; message?: string } | null;
  if (fn && fn.ok === false && String(fn.message || "").includes("lead_id")) {
    console.log("✓ RPC marketplace_apply_nurture_score: exists (rejects null lead_id as expected)");
  } else {
    console.log("✓ RPC marketplace_apply_nurture_score: callable");
  }

  console.log("\nAuto lead nurturing migration is present and queryable.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
