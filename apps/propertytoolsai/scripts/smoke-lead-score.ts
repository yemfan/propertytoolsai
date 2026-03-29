/**
 * Smoke test: recompute score + price for one lead via runLeadMarketplacePipeline.
 *
 * Usage (from repo root):
 *   npm run smoke:lead-score -w propertytoolsai -- <lead-uuid>
 *
 * Or from apps/propertytoolsai:
 *   npx tsx scripts/smoke-lead-score.ts <lead-uuid>
 *
 * Env: apps/propertytoolsai/.env.local must define:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

async function main() {
  const leadId =
    process.argv[2]?.trim() ||
    process.env.LEAD_ID?.trim() ||
    "";

  if (!leadId) {
    console.error(
      "Usage: npx tsx scripts/smoke-lead-score.ts <lead-uuid>\n   or: LEAD_ID=<uuid> npm run smoke:lead-score -w propertytoolsai"
    );
    process.exitCode = 1;
    return;
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (check apps/propertytoolsai/.env.local)"
    );
    process.exitCode = 1;
    return;
  }

  const { runLeadMarketplacePipeline } = await import("../lib/leadScorePipeline");

  console.log("Running pipeline for lead:", leadId);
  const result = await runLeadMarketplacePipeline(leadId);

  if (!result) {
    console.error("Pipeline returned null (lead not found, DB error, or update failed). Check logs above.");
    process.exitCode = 2;
    return;
  }

  console.log(JSON.stringify({ ok: true, leadId, ...result }, null, 2));
  process.exitCode = 0;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
