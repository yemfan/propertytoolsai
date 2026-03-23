/**
 * Verifies 20260417_home_value_sessions_tool_events_market_snapshots.sql
 * (home_value_sessions, tool_events, market_snapshots, leads extensions).
 *
 * Usage (from monorepo root):
 *   npm run smoke:20260417-home-value -w leadsmart-ai
 *
 * Env (apps/leadsmart-ai/.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (required for insert/update/delete checks; bypasses RLS)
 *
 * Read-only (schema / SELECT only if your key cannot write):
 *   tsx scripts/smoke-20260417-home-value-sessions.ts --read-only
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

const SESSION_PREFIX = "smoke_hv_";

async function main() {
  const readOnly = process.argv.includes("--read-only");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (apps/leadsmart-ai/.env.local)"
    );
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const runId = `${SESSION_PREFIX}${Date.now()}`;

  console.log("Smoke: 20260417_home_value_sessions_tool_events_market_snapshots");
  if (readOnly) console.log("(read-only mode)\n");
  else console.log("\n");

  // --- home_value_sessions ---
  const { error: hvsReadErr } = await supabase.from("home_value_sessions").select("id").limit(1);
  if (hvsReadErr) {
    console.error(`✗ home_value_sessions read: ${hvsReadErr.message}`);
    process.exitCode = 1;
    return;
  }
  console.log("✓ home_value_sessions: readable");

  if (readOnly) {
    const { error: teReadErr } = await supabase.from("tool_events").select("id").limit(1);
    if (teReadErr) {
      console.error(`✗ tool_events read: ${teReadErr.message}`);
      process.exitCode = 1;
      return;
    }
    console.log("✓ tool_events: readable");
    const { error: msReadErr } = await supabase.from("market_snapshots").select("id").limit(1);
    if (msReadErr) {
      console.error(`✗ market_snapshots read: ${msReadErr.message}`);
      process.exitCode = 1;
      return;
    }
    console.log("✓ market_snapshots: readable");
    const { error: leadsColErr } = await supabase
      .from("leads")
      .select("id, session_id, estimated_value, confidence, status")
      .limit(1);
    if (leadsColErr) {
      console.error(`✗ leads extended columns: ${leadsColErr.message}`);
      process.exitCode = 1;
      return;
    }
    console.log("✓ leads: extended columns readable");
    console.log("\n20260417 smoke passed (read-only). Use service role key for full write checks.");
    return;
  }

  const hvsRow = {
    session_id: runId,
    full_address: "123 Smoke Test Ln",
    city: "Austin",
    state: "TX",
    zip: "78701",
    source: "smoke_test",
  };
  const { data: hvsIns, error: hvsInsErr } = await supabase
    .from("home_value_sessions")
    .insert(hvsRow)
    .select("id")
    .single();
  if (hvsInsErr || !hvsIns?.id) {
    const msg = hvsInsErr?.message ?? "no id";
    console.error(`✗ home_value_sessions insert: ${msg}`);
    if (/row-level security/i.test(msg)) {
      console.error(
        "\n  → Inserts are blocked by RLS. Use the Service Role key in SUPABASE_SERVICE_ROLE_KEY\n" +
          "     (Dashboard → Settings → API → service_role secret), not the anon key.\n" +
          "     Or run: tsx scripts/smoke-20260417-home-value-sessions.ts --read-only\n"
      );
    }
    process.exitCode = 1;
    return;
  }
  console.log("✓ home_value_sessions: insert OK");

  const { error: hvsUpdErr } = await supabase
    .from("home_value_sessions")
    .update({ estimate_value: 450000 })
    .eq("id", hvsIns.id);
  if (hvsUpdErr) {
    console.error(`✗ home_value_sessions update (trigger updated_at): ${hvsUpdErr.message}`);
    await supabase.from("home_value_sessions").delete().eq("id", hvsIns.id);
    process.exitCode = 1;
    return;
  }
  console.log("✓ home_value_sessions: update OK");

  await supabase.from("home_value_sessions").delete().eq("id", hvsIns.id);
  console.log("✓ home_value_sessions: cleaned up test row");

  // --- tool_events ---
  const { error: teReadErr } = await supabase.from("tool_events").select("id").limit(1);
  if (teReadErr) {
    console.error(`✗ tool_events read: ${teReadErr.message}`);
    process.exitCode = 1;
    return;
  }
  console.log("✓ tool_events: readable");

  const { data: teIns, error: teInsErr } = await supabase
    .from("tool_events")
    .insert({
      session_id: runId,
      tool_name: "home_value",
      event_name: "smoke_test",
      metadata: { runId },
    })
    .select("id")
    .single();
  if (teInsErr || !teIns?.id) {
    console.error(`✗ tool_events insert: ${teInsErr?.message ?? "no id"}`);
    process.exitCode = 1;
    return;
  }
  console.log("✓ tool_events: insert OK");
  await supabase.from("tool_events").delete().eq("id", teIns.id);
  console.log("✓ tool_events: cleaned up test row");

  // --- market_snapshots ---
  const { error: msReadErr } = await supabase.from("market_snapshots").select("id").limit(1);
  if (msReadErr) {
    console.error(`✗ market_snapshots read: ${msReadErr.message}`);
    process.exitCode = 1;
    return;
  }
  console.log("✓ market_snapshots: readable");

  const today = new Date().toISOString().slice(0, 10);
  const { data: msIns, error: msInsErr } = await supabase
    .from("market_snapshots")
    .insert({
      city: "SmokeCity",
      zip: "00001",
      median_ppsf: 250,
      snapshot_date: today,
    })
    .select("id")
    .single();
  if (msInsErr || !msIns?.id) {
    console.error(`✗ market_snapshots insert: ${msInsErr?.message ?? "no id"}`);
    process.exitCode = 1;
    return;
  }
  console.log("✓ market_snapshots: insert OK");
  await supabase.from("market_snapshots").delete().eq("id", msIns.id);
  console.log("✓ market_snapshots: cleaned up test row");

  // --- leads columns (migration extends existing table) ---
  const { error: leadsColErr } = await supabase
    .from("leads")
    .select("id, session_id, estimated_value, confidence, status")
    .limit(1);
  if (leadsColErr) {
    console.error(`✗ leads extended columns: ${leadsColErr.message}`);
    console.error("  (If table is missing, run CRM migrations first.)");
    process.exitCode = 1;
    return;
  }
  console.log("✓ leads: extended columns readable (session_id, estimated_value, confidence, status)");

  console.log("\n20260417 home value migration smoke checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
