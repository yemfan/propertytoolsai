/**
 * Verifies 20260316000000_support_chat_supabase.sql
 * (support_conversations, support_messages + enums).
 *
 * Usage (from monorepo root):
 *   npm run smoke:20260316-support-chat -w leadsmartai
 *
 * Env (apps/leadsmartai/.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (required for insert/delete checks; bypasses RLS if enabled)
 *
 * Read-only (SELECT only):
 *   tsx scripts/smoke-20260316-support-chat-supabase.ts --read-only
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

const PUBLIC_ID_PREFIX = "smoke_sc_";

async function main() {
  const readOnly = process.argv.includes("--read-only");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (apps/leadsmartai/.env.local)"
    );
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const publicId = `${PUBLIC_ID_PREFIX}${Date.now()}`;

  console.log("Smoke: 20260316000000_support_chat_supabase");
  if (readOnly) console.log("(read-only mode)\n");
  else console.log("\n");

  const { error: convReadErr } = await supabase.from("support_conversations").select("id").limit(1);
  if (convReadErr) {
    console.error(`✗ support_conversations read: ${convReadErr.message}`);
    process.exitCode = 1;
    return;
  }
  console.log("✓ support_conversations: readable");

  const { error: msgReadErr } = await supabase.from("support_messages").select("id").limit(1);
  if (msgReadErr) {
    console.error(`✗ support_messages read: ${msgReadErr.message}`);
    process.exitCode = 1;
    return;
  }
  console.log("✓ support_messages: readable");

  if (readOnly) {
    console.log("\n20260316 support_chat smoke passed (read-only).");
    console.log("Use service role key for full insert/delete checks.");
    return;
  }

  const convRow = {
    public_id: publicId,
    customer_name: "Smoke Test User",
    customer_email: `smoke+${publicId}@example.test`,
    subject: "Support chat smoke test",
    status: "open" as const,
    priority: "normal" as const,
    source: "smoke_test",
  };

  const { data: convIns, error: convInsErr } = await supabase
    .from("support_conversations")
    .insert(convRow)
    .select("id")
    .single();

  if (convInsErr || !convIns?.id) {
    const msg = convInsErr?.message ?? "no id";
    console.error(`✗ support_conversations insert: ${msg}`);
    if (/row-level security/i.test(msg)) {
      console.error(
        "\n  → Use the Service Role key in SUPABASE_SERVICE_ROLE_KEY\n" +
          "     (Dashboard → Settings → API → service_role secret), not the anon key.\n" +
          "     Or run: tsx scripts/smoke-20260316-support-chat-supabase.ts --read-only\n"
      );
    }
    process.exitCode = 1;
    return;
  }
  console.log("✓ support_conversations: insert OK");

  const msgRow = {
    conversation_id: convIns.id,
    sender_type: "customer" as const,
    sender_name: "Smoke Test User",
    body: "Hello from smoke test — enum columns (MessageSender, SupportMessageType).",
    message_type: "text" as const,
    is_internal_note: false,
    metadata: { smoke: true, run: publicId },
  };

  const { data: msgIns, error: msgInsErr } = await supabase
    .from("support_messages")
    .insert(msgRow)
    .select("id")
    .single();

  if (msgInsErr || !msgIns?.id) {
    console.error(`✗ support_messages insert: ${msgInsErr?.message ?? "no id"}`);
    await supabase.from("support_conversations").delete().eq("id", convIns.id);
    process.exitCode = 1;
    return;
  }
  console.log("✓ support_messages: insert OK (jsonb metadata)");

  const { error: delMsgErr } = await supabase.from("support_messages").delete().eq("id", msgIns.id);
  if (delMsgErr) {
    console.error(`✗ support_messages delete: ${delMsgErr.message}`);
    process.exitCode = 1;
    return;
  }
  console.log("✓ support_messages: delete OK");

  const { error: delConvErr } = await supabase.from("support_conversations").delete().eq("id", convIns.id);
  if (delConvErr) {
    console.error(`✗ support_conversations delete: ${delConvErr.message}`);
    process.exitCode = 1;
    return;
  }
  console.log("✓ support_conversations: delete OK (cascade already exercised if FK enforced)");

  console.log("\n20260316 support_chat smoke passed.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
