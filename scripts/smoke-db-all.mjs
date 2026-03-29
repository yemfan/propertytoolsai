/**
 * Run all Supabase migration smoke tests (both apps).
 * From repo root: pnpm run smoke:db:all
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
  const label = workspace === "leadsmartai" ? "leadsmartai" : "propertytoolsai";
  console.log(`\n=== ${label} ${script} ===\n`);
  execSync(`pnpm --filter ${workspace} run ${script}`, {
    stdio: "inherit",
    cwd: root,
    env: process.env,
  });
}

try {
  console.log("Running migration smoke tests (excludes smoke:lead-score)…\n");
  for (const s of LEADSMART) run("leadsmartai", s);
  for (const s of PROPERTY_TOOLS) run("propertytoolsai", s);
  console.log("\n✓ All migration smoke tests passed.\n");
} catch {
  process.exitCode = 1;
}
