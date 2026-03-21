/**
 * Verifies SEO optimization engine: Supabase tables + optional OpenAI pipeline run.
 *
 * Usage (from apps/property-tools):
 *   npx tsx scripts/smoke-seo-optimization.ts
 *   npx tsx scripts/smoke-seo-optimization.ts --ai
 *
 * Env: .env.local — NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *      For --ai: OPENAI_API_KEY
 *
 * Note: dotenv must run before importing `lib` (supabaseServer reads env at module load).
 */

import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

const TOOL = "cap-rate-calculator";
const LOC = "los-angeles-ca";

async function main() {
  const wantAi = process.argv.includes("--ai");

  const { createClient } = await import("@supabase/supabase-js");
  const {
    fetchSeoContentOverride,
    getLatestPerformanceForPage,
    insertPerformanceSnapshot,
  } = await import("../lib/seoOptimization/db");
  const { encodeProgrammaticPageKey } = await import("../lib/seoOptimization/pageKey");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (.env.local)");
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(url, key);

  console.log("1) Tables readable (seo_* optimization)...\n");

  for (const table of [
    "seo_page_performance",
    "seo_content_overrides",
    "seo_optimization_runs",
    "seo_title_ab_variants",
  ]) {
    const { error } = await supabase.from(table).select("*").limit(1);
    if (error) {
      console.error(`   FAIL ${table}:`, error.message);
      process.exitCode = 1;
      return;
    }
    console.log(`   OK  ${table}`);
  }

  const pageKey = encodeProgrammaticPageKey(TOOL, LOC);
  const today = new Date().toISOString().slice(0, 10);

  console.log("\n2) Upsert test metrics row...\n");

  const ins = await insertPerformanceSnapshot({
    pageKey,
    urlPath: `/tool/${TOOL}/${LOC}`,
    impressions: 500,
    ctr: 0.02,
    positionAvg: 14,
    periodStart: today,
    periodEnd: today,
    raw: { source: "smoke-seo-optimization" },
  });

  if (!ins.ok) {
    console.error("   FAIL insertPerformanceSnapshot:", ins.error);
    process.exitCode = 1;
    return;
  }
  console.log("   OK  insertPerformanceSnapshot", pageKey);

  const latest = await getLatestPerformanceForPage(pageKey);
  if (!latest || latest.impressions !== 500) {
    console.error("   FAIL getLatestPerformanceForPage", latest);
    process.exitCode = 1;
    return;
  }
  console.log("   OK  getLatestPerformanceForPage", {
    impressions: latest.impressions,
    ctr: latest.ctr,
    positionAvg: latest.positionAvg,
  });

  const overrideBefore = await fetchSeoContentOverride(pageKey);
  console.log("\n3) Override before AI run:", overrideBefore ? `version ${overrideBefore.version}` : "(none)");

  if (!wantAi) {
    console.log("\nDone (DB only). Run with --ai to call OpenAI + write seo_content_overrides.\n");
    return;
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.error("\n--ai requires OPENAI_API_KEY in .env.local");
    process.exitCode = 1;
    return;
  }

  console.log("\n4) runOptimizationForPageKey (force) — calls OpenAI...\n");

  const { runOptimizationForPageKey } = await import("../lib/seoOptimization/pipeline");

  const result = await runOptimizationForPageKey(pageKey, { force: true });

  console.log("   Result:", result);

  if (result.status !== "success") {
    console.error("\nOptimizer did not succeed.");
    process.exitCode = 1;
    return;
  }

  const overrideAfter = await fetchSeoContentOverride(pageKey);
  if (!overrideAfter?.title) {
    console.error("   FAIL: expected seo_content_overrides row with title");
    process.exitCode = 1;
    return;
  }

  console.log("\n5) Override after run:");
  console.log("   title:", overrideAfter.title.slice(0, 80) + (overrideAfter.title.length > 80 ? "…" : ""));
  console.log(
    "   meta:",
    (overrideAfter.meta_description ?? "").slice(0, 100) +
      ((overrideAfter.meta_description?.length ?? 0) > 100 ? "…" : "")
  );
  console.log("\nAll checks passed.\n");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
