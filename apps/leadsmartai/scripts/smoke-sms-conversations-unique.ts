/**
 * Verifies 20260324_sms_conversations_unique.sql (unique index on sms_conversations.contact_id).
 *
 * Usage (from repo root):
 *   npm run smoke:sms-conversations-unique -w leadsmartai
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

  console.log("Checking sms_conversations unique migration (20260324_sms_conversations_unique)...\n");

  const { error: readErr } = await supabase.from("sms_conversations").select("id,contact_id").limit(1);
  if (readErr) {
    console.error(`✗ sms_conversations: ${readErr.message}`);
    process.exitCode = 1;
    return;
  }
  console.log("✓ sms_conversations: readable");

  const { data: convRows, error: convErr } = await supabase.from("sms_conversations").select("contact_id");
  if (convErr) {
    console.error(`✗ sms_conversations list: ${convErr.message}`);
    process.exitCode = 1;
    return;
  }
  const used = new Set((convRows ?? []).map((r) => r.contact_id));

  const { data: leadRows, error: leadErr } = await supabase.from("contacts").select("id").limit(200);
  if (leadErr) {
    console.error(`✗ leads: ${leadErr.message}`);
    process.exitCode = 1;
    return;
  }

  const freshLeadId = (leadRows ?? []).find((l) => !used.has(l.id))?.id;
  if (freshLeadId == null) {
    console.log(
      "○ Duplicate insert test skipped (no lead without an sms_conversation in sample); unique index assumed from migration."
    );
    console.log("\nSMS conversations unique migration checks passed (read-only).");
    return;
  }

  const { error: ins1 } = await supabase
    .from("sms_conversations")
    .insert({ contact_id: freshLeadId, messages: [] });
  if (ins1) {
    console.error(`✗ first insert failed: ${ins1.message}`);
    process.exitCode = 1;
    return;
  }

  const { error: ins2 } = await supabase
    .from("sms_conversations")
    .insert({ contact_id: freshLeadId, messages: [] });

  await supabase.from("sms_conversations").delete().eq("contact_id", freshLeadId);

  if (!ins2) {
    console.error("✗ duplicate lead_id was accepted (unique index missing or wrong)");
    process.exitCode = 1;
    return;
  }

  const msg = `${ins2.message} ${(ins2 as { code?: string }).code ?? ""}`;
  if (!/duplicate|unique|23505/i.test(msg)) {
    console.error(`✗ second insert failed unexpectedly: ${ins2.message}`);
    process.exitCode = 1;
    return;
  }

  console.log("✓ duplicate lead_id rejected (unique index active)");
  console.log("\nSMS conversations unique migration verified.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
