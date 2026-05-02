/**
 * One-off proof for fix/contacts-intake-defensive-postinsert.
 * Calls runContactIngestion directly against prod's drifted schema and
 * confirms: (a) the contact row inserts, (b) the missing-table writes
 * downstream warn but don't throw. Cleans up after itself.
 *
 *   pnpm --filter leadsmartai exec tsx scripts/smoke-intake-defensive.ts
 *
 * Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or
 * loaded from apps/leadsmartai/.env.local).
 */
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });
config({ path: resolve(__dirname, "../../leadsmart-mobile/.env.local"), override: true });

const { supabaseAdmin } = await import("../lib/supabase/admin");
const { runContactIngestion } = await import("../lib/contact-intake/ingestionPipeline");

const AGENT_ID = process.env.SMOKE_AGENT_ID ?? "20";
const TAG = `smoke-intake-${Date.now()}`;

console.log(`[smoke] agent=${AGENT_ID} tag=${TAG}`);

let leadId: string | null = null;
try {
  const result = await runContactIngestion({
    agentId: AGENT_ID,
    planType: "premium",
    fields: {
      name: `Defensive Test ${TAG}`,
      email: `${TAG}@example.invalid`,
      phone: "5550000000",
      property_address: "8818 Arcadia",
      notes: TAG,
      source: "smoke-test",
    },
    intakeChannel: "manual",
    duplicateStrategy: "create_anyway",
    skipEnrichment: true,
  });

  console.log(`[smoke] runContactIngestion returned`, result);
  if (result.action !== "inserted") {
    console.error(`[smoke] FAIL: expected action=inserted, got`, result);
    process.exit(2);
  }
  leadId = result.leadId ?? null;
  console.log(`[smoke] OK — contact inserted as id=${leadId} despite drifted schema`);
} catch (e) {
  console.error(`[smoke] FAIL: runContactIngestion threw`, e);
  process.exit(2);
} finally {
  if (leadId) {
    const { error } = await supabaseAdmin.from("contacts").delete().eq("id", leadId);
    if (error) console.warn(`[smoke] cleanup: contacts delete`, error.message);
    else console.log(`[smoke] cleanup: deleted contact ${leadId}`);
  }
}

console.log(`[smoke] done`);
