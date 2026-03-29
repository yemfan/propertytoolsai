/**
 * SERP Dominator smoke: tables + full campaign (5× OpenAI). Loads .env.local before DB.
 *
 *   npx tsx scripts/smoke-serp-dominator.ts
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY
 */

import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const { runSerpDominatorCampaign } = await import("../lib/serpDominator/pipeline");
  const { getSerpPageByPath, insertRankSnapshot } = await import("../lib/serpDominator/db");
  const { buildSerpHubPath } = await import("../lib/serpDominator/slug");
  const { normalizeKeywordForDedupe } = await import("../lib/keywordDiscovery/normalize");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(url, key);
  for (const table of ["serp_dominator_campaigns", "serp_dominator_pages", "serp_rank_snapshots"]) {
    const { error } = await supabase.from(table).select("*").limit(1);
    if (error) {
      console.error(`Table ${table}:`, error.message, "\nApply migrations 20260406 / 20260407");
      process.exitCode = 1;
      return;
    }
    console.log("OK ", table);
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.log("\nSkip campaign test (OPENAI_API_KEY not set). Tables OK.\n");
    return;
  }

  const seed = "cap rate rental quick smoke";
  console.log("\nRunning runSerpDominatorCampaign (5 page types)...\n");

  const result = await runSerpDominatorCampaign(seed, {
    siteOrigin: process.env.NEXT_PUBLIC_SITE_URL || "https://www.propertytools.ai",
  });

  if (result.error) {
    console.error("Campaign error:", result.error);
    process.exitCode = 1;
    return;
  }

  console.log("campaignId:", result.campaignId);
  console.log("keywordSlug:", result.keywordSlug);
  console.log("pages:", result.pages);

  const okPages = result.pages.filter((p) => p.ok).length;
  if (okPages < 5) {
    console.error("Expected 5 successful pages, got", okPages);
    process.exitCode = 1;
    return;
  }

  const toolPath = buildSerpHubPath(result.keywordSlug, "tool");
  const row = await getSerpPageByPath(toolPath);
  if (!row?.title) {
    console.error("FAIL: could not read back tool page at", toolPath);
    process.exitCode = 1;
    return;
  }
  console.log("\nOK read-back:", toolPath, "→", row.title.slice(0, 60) + "…");

  const rank = await insertRankSnapshot({
    keywordNormalized: normalizeKeywordForDedupe(seed),
    pagePath: toolPath,
    position: 12.5,
    source: "manual",
    notes: "smoke-serp-dominator",
  });
  if (!rank.ok) {
    console.error("Rank snapshot:", rank.error);
    process.exitCode = 1;
    return;
  }
  console.log("OK  rank snapshot inserted");

  console.log("\nAll checks passed.\n");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
