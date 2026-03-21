/**
 * Verifies 20260329_agent_ai_assistant.sql (agents AI flags, lead_conversations, ai_followup_jobs).
 *
 * Usage (from repo root):
 *   npm run smoke:agent-ai-assistant -w leadsmart-ai
 *
 * Env: apps/leadsmart-ai/.env.local:
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
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (check apps/leadsmart-ai/.env.local)"
    );
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(url, key);

  console.log("Checking agent AI assistant migration (20260329_agent_ai_assistant)...\n");

  const { error: agentsErr } = await supabase
    .from("agents")
    .select("id,ai_assistant_enabled,ai_assistant_mode")
    .limit(1);
  if (agentsErr) {
    console.error(`✗ agents (ai_assistant_*): ${agentsErr.message}`);
    process.exitCode = 1;
    return;
  }
  console.log("✓ agents: ai_assistant_enabled, ai_assistant_mode");

  const { error: convErr } = await supabase
    .from("lead_conversations")
    .select("id,lead_id,agent_id,messages,preferences,updated_at")
    .limit(1);
  if (convErr) {
    console.error(`✗ lead_conversations: ${convErr.message}`);
    process.exitCode = 1;
    return;
  }
  console.log("✓ lead_conversations");

  const { error: jobErr } = await supabase
    .from("ai_followup_jobs")
    .select("id,lead_id,agent_id,kind,run_at,status,created_at")
    .limit(1);
  if (jobErr) {
    console.error(`✗ ai_followup_jobs: ${jobErr.message}`);
    process.exitCode = 1;
    return;
  }
  console.log("✓ ai_followup_jobs");

  console.log("\nAgent AI assistant migration is present and queryable.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
