/**
 * Concatenates LeadSmart AI migration SQL files (ordered by filename) into one script.
 * Excludes destructive resets and bundle files that duplicate individual migrations.
 *
 * Output: apps/leadsmart-mobile/supabase/consolidated_all_migrations.sql
 * Source: apps/leadsmartai/supabase/migrations
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(__dirname, "..");
const aiMigrations = join(mobileRoot, "..", "leadsmartai", "supabase", "migrations");
const outDir = join(mobileRoot, "supabase");
const outFile = join(outDir, "consolidated_all_migrations.sql");

const EXCLUDE = new Set([
  "20250319_reset_all_app_data.sql",
  "20250319_bundle_all.sql",
  "20260319_bundle_all.sql",
  "20260326_full_ai_system_bundle.sql",
]);

function shouldInclude(name) {
  if (!name.endsWith(".sql")) return false;
  if (EXCLUDE.has(name)) return false;
  return true;
}

async function main() {
  const all = (await readdir(aiMigrations)).filter(shouldInclude);
  all.sort((a, b) => a.localeCompare(b, "en"));

  const header = `-- LeadSmart AI — consolidated migrations (generated)
-- Generated: ${new Date().toISOString()}
-- Source: apps/leadsmartai/supabase/migrations (${all.length} files)
-- Excluded: ${[...EXCLUDE].join(", ")}
--
-- On a database that already applied these migrations, expect errors (duplicate objects, etc.).
-- For fresh installs, run against an empty public schema or use supabase db push.
`;

  const parts = [header];
  for (const name of all) {
    const body = await readFile(join(aiMigrations, name), "utf8");
    parts.push(
      `\n-- ========================================================================\n-- FILE: ${name}\n-- ========================================================================\n\n`,
      body.trimEnd(),
      "\n"
    );
  }

  await mkdir(outDir, { recursive: true });
  await writeFile(outFile, parts.join(""), "utf8");
  console.log(`Wrote ${outFile} (${all.length} migrations concatenated)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
