/**
 * Verifies 20260323_ai_sms_responder.sql (sms_conversations table).
 *
 * Usage (from repo root):
 *   npm run smoke:ai-sms-responder -w leadsmartai
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

  console.log("Checking AI SMS responder migration (20260323_ai_sms_responder)...\n");

  const { error } = await supabase
    .from("sms_conversations")
    .select("id,lead_id,messages,stage,last_ai_reply_at,created_at")
    .limit(1);

  if (error) {
    console.error(`✗ sms_conversations: ${error.message}`);
    if (/relation|does not exist|schema cache/i.test(error.message)) {
      console.error("  → Table missing or PostgREST cache stale.");
    }
    process.exitCode = 1;
    return;
  }

  console.log("✓ sms_conversations: OK (readable)");
  console.log("\nAI SMS responder migration is present and queryable.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
