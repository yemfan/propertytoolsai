/**
 * Full SoCal pipeline:
 *   1) Upsert all places (incorporated + CDPs from JSON) into `city_market_data`
 *   2) Generate and upsert SEO pages into `seo_pages` (all templates + money-keyword variants)
 *
 * Usage (apps/propertytoolsai):
 *   npx tsx scripts/populate-socal-seo-pipeline.ts --dry-run
 *   npx tsx scripts/populate-socal-seo-pipeline.ts --city-market-only
 *   npx tsx scripts/populate-socal-seo-pipeline.ts --seo-only
 *   npx tsx scripts/populate-socal-seo-pipeline.ts --max-cities=20
 *
 * Env: `.env.local` — NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { generateSeoPagesBatch } from "../lib/seo-generator/batch";
import { buildMoneyKeywordInputs } from "../lib/seo-generator/money-keywords";
import { buildSeoSeedInputs } from "../lib/seo-generator/seeds";
import { loadSocalCountyPlaces } from "./lib/loadSocalCountyPlaces";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

function argNum(name: string): number | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (!hit) return undefined;
  const n = Number(hit.slice(prefix.length));
  return Number.isFinite(n) ? n : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

type MarketRow = {
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

async function upsertCityMarketData(rows: MarketRow[]) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const batchSize = 80;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from("city_market_data")
      .upsert(chunk, { onConflict: "city,state", ignoreDuplicates: true })
      .select("city");
    if (error) throw error;
    inserted += data?.length ?? 0;
    console.log(`  city_market_data batch ${Math.floor(i / batchSize) + 1}: ${data?.length ?? 0} new row(s) (duplicates skipped)`);
  }
  return inserted;
}

async function main() {
  const dryRun = hasFlag("dry-run");
  const cityMarketOnly = hasFlag("city-market-only");
  const seoOnly = hasFlag("seo-only");
  const maxCities = argNum("max-cities");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dryRun && !seoOnly && (!url || !key)) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exitCode = 1;
    return;
  }
  if (!dryRun && seoOnly && (!url || !key)) {
    console.error("Missing Supabase env for seo_pages upsert");
    process.exitCode = 1;
    return;
  }

  const placeMap = loadSocalCountyPlaces();
  let places = [...placeMap.values()].sort((a, b) => a.city.localeCompare(b.city));
  if (maxCities != null && maxCities > 0) {
    places = places.slice(0, maxCities);
  }

  console.log(`Places loaded: ${places.length}${maxCities ? ` (capped by --max-cities=${maxCities})` : ""}`);
  console.log(`  CDPs: ${places.filter((p) => p.placeKind === "cdp").length}, incorporated: ${places.filter((p) => p.placeKind === "incorporated").length}\n`);

  const marketRows: MarketRow[] = places.map((p) => ({
    city: p.city,
    state: "CA",
    median_price: 0,
    price_per_sqft: 0,
    trend: "stable",
    days_on_market: 0,
    inventory: 0,
    source: "seed_socal_county_pipeline",
    raw_payload: {
      countyLabel: p.countyLabel,
      placeKind: p.placeKind,
    },
  }));

  const seoCities = places.map((p) => ({ city: p.city, state: "CA" as const }));
  const seedInputs = buildSeoSeedInputs({ cities: seoCities });
  const moneyInputs = places.flatMap((p) => buildMoneyKeywordInputs(p.city, "CA"));
  const allSeoInputs = [...seedInputs, ...moneyInputs];

  console.log(`SEO generator inputs: ${allSeoInputs.length} (${seedInputs.length} template combos + ${moneyInputs.length} money-keyword pages)\n`);

  if (dryRun) {
    console.log("Dry run — no database writes.");
    console.log(`Would upsert ${marketRows.length} city_market_data rows.`);
    console.log(`Would generate ${allSeoInputs.length} seo_pages rows.`);
    return;
  }

  if (!seoOnly) {
    console.log("Upserting city_market_data…");
    const n = await upsertCityMarketData(marketRows);
    console.log(`city_market_data done (rows returned from insert ~new): ${n}\n`);
  }

  if (!cityMarketOnly) {
    console.log("Generating and upserting seo_pages (chunked)…");
    const chunkSize = Number(process.env.SEO_BATCH_CHUNK ?? "35");
    let ok = 0;
    let fail = 0;
    for (let i = 0; i < allSeoInputs.length; i += chunkSize) {
      const chunk = allSeoInputs.slice(i, i + chunkSize);
      const results = await generateSeoPagesBatch(chunk);
      for (const r of results) {
        if (r.success) ok += 1;
        else fail += 1;
      }
      const bad = results.filter((x) => !x.success);
      console.log(`  seo chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(allSeoInputs.length / chunkSize)}: +${chunk.length} processed (${results.filter((x) => x.success).length} ok)`);
      if (bad.length && i === 0) {
        console.log("  First errors:", bad.slice(0, 3).map((b) => `${b.slug}: ${b.error ?? "unknown"}`).join(" | "));
      }
    }
    console.log(`\nseo_pages done. Success: ${ok}, failures: ${fail}.`);
  }

  console.log("\nPipeline finished.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
