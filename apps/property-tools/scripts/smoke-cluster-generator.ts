/**
 * Verifies Auto Cluster Generator: tables, seed, generate one page, read back.
 *
 * Usage (from apps/property-tools):
 *   npx tsx scripts/smoke-cluster-generator.ts
 *   npx tsx scripts/smoke-cluster-generator.ts --ai     # allow OpenAI (costs tokens)
 *   npx tsx scripts/smoke-cluster-generator.ts --no-ai  # template only
 *
 * Env: .env.local — NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *      Optional: OPENAI_API_KEY
 */

import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

const TOPIC = "first-time-home-buyer-guide";
const LOC = "los-angeles-ca";

async function main() {
  const useAi = process.argv.includes("--ai");
  const noAi = process.argv.includes("--no-ai");

  if (useAi && noAi) {
    console.error("Use only one of --ai or --no-ai");
    process.exitCode = 1;
    return;
  }

  const { createClient } = await import("@supabase/supabase-js");
  const { getClusterPage, upsertClusterTopic } = await import("../lib/clusterGenerator/db");
  const { CLUSTER_TOPICS } = await import("../lib/clusterGenerator/topics");
  const { generateClusterPage } = await import("../lib/clusterGenerator/pipeline");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (.env.local)");
    process.exitCode = 1;
    return;
  }

  if (noAi) {
    process.env.CLUSTER_AI = "false";
  }

  const supabase = createClient(url, key);

  console.log("1) Cluster tables...\n");
  for (const table of ["seo_cluster_topics", "seo_cluster_pages", "seo_cluster_generation_runs"]) {
    const { error } = await supabase.from(table).select("*").limit(1);
    if (error) {
      console.error(`   FAIL ${table}:`, error.message);
      process.exitCode = 1;
      return;
    }
    console.log(`   OK  ${table}`);
  }

  console.log("\n2) Seed one topic row (upsert)...\n");
  const topicDef = CLUSTER_TOPICS.find((t) => t.slug === TOPIC);
  if (!topicDef) {
    console.error("Topic not found in CLUSTER_TOPICS");
    process.exitCode = 1;
    return;
  }
  const seed = await upsertClusterTopic(topicDef);
  if (!seed.ok) {
    console.error(seed.error);
    process.exitCode = 1;
    return;
  }
  console.log("   OK  upsertClusterTopic", TOPIC);

  console.log("\n3) generateClusterPage (force)...\n");
  const gen = await generateClusterPage(TOPIC, LOC, {
    force: true,
    useAi: useAi ? true : noAi ? false : undefined,
  });
  console.log("   ", gen);
  if (gen.status === "failed") {
    process.exitCode = 1;
    return;
  }

  console.log("\n4) getClusterPage (read back)...\n");
  const row = await getClusterPage(TOPIC, LOC);
  if (!row?.title) {
    console.error("   FAIL: no row or title");
    process.exitCode = 1;
    return;
  }
  console.log("   OK  title:", row.title.slice(0, 90) + (row.title.length > 90 ? "…" : ""));
  console.log("   OK  meta:", (row.meta_description ?? "").slice(0, 100) + "…");
  console.log("   OK  insights:", row.payload?.insights?.length ?? 0);
  console.log("   OK  internal_links:", Array.isArray(row.internal_links) ? row.internal_links.length : 0);

  console.log("\nAll checks passed. Path: /guides/" + TOPIC + "/" + LOC + "\n");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
