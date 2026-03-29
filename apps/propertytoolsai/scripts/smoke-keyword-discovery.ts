/**
 * Keyword discovery smoke test (loads .env.local before Supabase modules).
 *
 *   npx tsx scripts/smoke-keyword-discovery.ts
 */

import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const { runKeywordDiscovery } = await import("../lib/keywordDiscovery/pipeline");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(url, key);
  const { error: tErr } = await supabase.from("seo_keyword_candidates").select("id").limit(1);
  if (tErr) {
    console.error("Table check failed:", tErr.message, "\nApply migration 20260403_keyword_discovery_engine.sql");
    process.exitCode = 1;
    return;
  }
  console.log("OK  seo_keyword_candidates reachable\n");

  const result = await runKeywordDiscovery({
    seeds: ["cap rate rental"],
    minPerSeed: 35,
    persist: true,
  });

  if (result.error) {
    console.error(result.error);
    process.exitCode = 1;
    return;
  }

  console.log("runId:", result.runId);
  console.log("stats:", result.stats);
  console.log("top 5:", result.candidates.slice(0, 5).map((c) => `${c.score} | ${c.intent} | ${c.display_keyword}`));
  console.log("\nDone.\n");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
