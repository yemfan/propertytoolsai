/**
 * Seeds `public.city_market_data` with incorporated cities + CDPs in:
 *   - Los Angeles, Orange, San Bernardino counties (CA)
 *
 * Data: `scripts/data/socal-county-cities.json` + `scripts/data/socal-county-cdps.json`
 *
 * Usage (from apps/propertytoolsai):
 *   npx tsx scripts/seed-socal-county-cities.ts
 *   npx tsx scripts/seed-socal-county-cities.ts --dry-run
 *
 * Env: `.env.local` — NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadSocalCountyPlaces } from "./lib/loadSocalCountyPlaces";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

type Row = {
  city: string;
  state: string;
  median_price: number;
  price_per_sqft: number;
  trend: "stable";
  days_on_market: number;
  inventory: number;
  source: string;
  raw_payload: Record<string, unknown>;
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dryRun && (!url || !key)) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (apps/propertytoolsai/.env.local)"
    );
    process.exitCode = 1;
    return;
  }

  const map = loadSocalCountyPlaces();
  const rows: Row[] = [...map.values()]
    .map((p) => ({
      city: p.city,
      state: "CA",
      median_price: 0,
      price_per_sqft: 0,
      trend: "stable" as const,
      days_on_market: 0,
      inventory: 0,
      source: "seed_socal_county_json",
      raw_payload: {
        countyLabel: p.countyLabel,
        placeKind: p.placeKind,
      },
    }))
    .sort((a, b) => a.city.localeCompare(b.city));

  const cdps = rows.filter((r) => r.raw_payload.placeKind === "cdp").length;
  console.log(`Loaded ${rows.length} unique places (CA): ${cdps} CDPs, ${rows.length - cdps} incorporated.\n`);

  if (dryRun) {
    console.log("First 40:");
    for (const r of rows.slice(0, 40)) {
      console.log(`  ${r.city}  [${r.raw_payload.placeKind}]  (${r.raw_payload.countyLabel})`);
    }
    if (rows.length > 40) console.log(`  … and ${rows.length - 40} more`);
    return;
  }

  const supabase = createClient(url!, key!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const batchSize = 80;
  let returned = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from("city_market_data")
      .upsert(chunk, { onConflict: "city,state", ignoreDuplicates: true })
      .select("city");

    if (error) {
      console.error("Upsert error:", error.message);
      process.exitCode = 1;
      return;
    }
    const n = data?.length ?? 0;
    returned += n;
    console.log(
      `Batch ${Math.floor(i / batchSize) + 1}: ${n} row(s) returned (${chunk.length} in batch; duplicates ignored).`
    );
  }

  console.log(`\nDone. Approx. new inserts (rows returned): ${returned}.`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
