/**
 * Run all Supabase migration smoke tests (both apps).
 * From repo root: npm run smoke:db:all
 *
 * Excludes smoke:lead-score (requires a lead UUID).
 */
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const LEADSMART = [
  "smoke:client-portal",
  "smoke:growth-engine",
  "smoke:lead-nurturing",
  "smoke:lead-marketplace",
  "smoke:twilio-sms",
  "smoke:ai-sms-responder",
  "smoke:sms-conversations-unique",
  "smoke:traffic-generation",
  "smoke:migrations-20260326",
  "smoke:leadsmart-ai-layer",
  "smoke:comparison-reports",
  "smoke:agent-ai-assistant",
  "smoke:20260319-schema",
];

const PROPERTY_TOOLS = [
  "smoke:growth-engine",
  "smoke:lead-nurturing",
  "smoke:lead-marketplace",
  "smoke:twilio-sms",
  "smoke:ai-sms-responder",
  "smoke:sms-conversations-unique",
  "smoke:traffic-generation",
  "smoke:migrations-20260326",
  "smoke:leadsmart-ai-layer",
  "smoke:20260319-schema",
];

function run(workspace, script) {
  const label = workspace === "leadsmart-ai" ? "leadsmart-ai" : "property-tools";
  console.log(`\n=== ${label} ${script} ===\n`);
  execSync(`npm run ${script} -w ${workspace}`, {
    stdio: "inherit",
    cwd: root,
    env: process.env,
  });
}

try {
  console.log("Running migration smoke tests (excludes smoke:lead-score)…\n");
  for (const s of LEADSMART) run("leadsmart-ai", s);
  for (const s of PROPERTY_TOOLS) run("property-tools", s);
  console.log("\n✓ All migration smoke tests passed.\n");
} catch {
  process.exitCode = 1;
}
