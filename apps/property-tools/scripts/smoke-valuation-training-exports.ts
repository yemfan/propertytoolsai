/**
 * Verifies valuation ML training objects after migration 20260450000000.
 *
 * Usage (from repo root):
 *   npm run smoke:valuation-training-exports -w property-tools
 *
 * Env: apps/property-tools/.env.local — NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (apps/property-tools/.env.local)");
    process.exitCode = 1;
    return;
  }

  console.log("Checking valuation training export schema + reads…\n");

  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  const { data: rowSample, error: viewErr } = await supabaseAdmin
    .from("valuation_training_rows")
    .select("*")
    .limit(1);

  if (viewErr) {
    console.error(`✗ valuation_training_rows: ${viewErr.message}`);
    process.exitCode = 1;
    return;
  }
  console.log("✓ valuation_training_rows: query OK");
  if (rowSample?.length) {
    const r = rowSample[0] as Record<string, unknown>;
    const keys = ["id", "landing_page", "seo_slug", "lead_source", "tax_anchor_estimate", "actual_sale_price"];
    const present = keys.filter((k) => k in r);
    console.log(`  sample columns present: ${present.join(", ")}`);
  } else {
    console.log("  (no labeled rows yet — view is empty but readable)");
  }

  const { error: exportTableErr } = await supabaseAdmin.from("valuation_training_exports").select("id").limit(1);

  if (exportTableErr) {
    console.error(`✗ valuation_training_exports: ${exportTableErr.message}`);
    process.exitCode = 1;
    return;
  }
  console.log("✓ valuation_training_exports: table readable");

  const { getTrainingDataset } = await import("@/lib/valuation-training/service");
  const ds = await getTrainingDataset({ limit: 3 });
  console.log(`✓ getTrainingDataset (limit 3): ${ds.length} row(s), enrichment fields on first row:`, {
    api_vs_comps_diff_pct: ds[0]?.api_vs_comps_diff_pct ?? null,
    months_from_estimate_to_sale: ds[0]?.months_from_estimate_to_sale ?? null,
  });

  console.log("\nAll checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
