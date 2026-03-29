import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

import Papa from "papaparse";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

const DEFAULT_OUT = "ml/valuation/data/valuation_training_data.csv";

async function main() {
  const outPath = process.argv[2] ?? DEFAULT_OUT;
  const limit = process.argv[3] ? Number(process.argv[3]) : 20000;

  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  const fields = [
    // Target
    "actual_sale_price",
    // subject facts
    "beds",
    "baths",
    "sqft",
    "lot_size",
    "year_built",
    "city",
    "state",
    "zip",
    "property_type",
    "condition",
    // valuation engine outputs
    "api_estimate",
    "comps_estimate",
    "final_estimate",
    "low_estimate",
    "high_estimate",
    "confidence_score",
    "comparable_count",
    "weighted_ppsf",
    "listing_trend_adjustment_pct",
    "condition_adjustment_pct",
    "range_spread_pct",
    // ML “tax anchor” (new nullable column)
    "tax_anchor_estimate",
    // scenario/meta
    "tier_used",
    "valuation_version",
    "confidence_label",
    // time features
    "created_at",
    "actual_sale_date",
  ];

  let effectiveFields = fields;
  let rows: any[] = [];

  try {
    const { data, error } = await supabaseAdmin
      .from("valuation_runs")
      .select(effectiveFields.join(","))
      .not("actual_sale_price", "is", null)
      .limit(limit);

    if (error) throw error;
    rows = data ?? [];
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    if (msg.includes("tax_anchor_estimate") || msg.includes("does not exist")) {
      effectiveFields = effectiveFields.filter((f) => f !== "tax_anchor_estimate");
      const { data, error } = await supabaseAdmin
        .from("valuation_runs")
        .select(effectiveFields.join(","))
        .not("actual_sale_price", "is", null)
        .limit(limit);
      if (error) throw error;
      rows = data ?? [];
    } else {
      throw err;
    }
  }

  const outAbs = resolve(__dirname, "..", outPath);
  fs.mkdirSync(dirname(outAbs), { recursive: true });

  const header = effectiveFields;
  const mapped = (rows ?? []).map((row: any) => {
    const out: Record<string, unknown> = {};
    for (const key of effectiveFields) out[key] = row[key] ?? null;
    return out;
  });

  const csv = Papa.unparse(mapped, { columns: header, header: true });
  fs.writeFileSync(outAbs, csv, "utf8");

  console.log(`Exported ${mapped.length} training rows to ${outPath}`);
}

void main().catch((err) => {
  console.error("Export failed:", err);
  process.exit(1);
});

