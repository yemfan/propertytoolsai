/**
 * Copies `apps/leadsmartai/supabase/migrations/*.sql` → `apps/leadsmart-mobile/supabase/migrations/`.
 * Run from repo: pnpm --filter leadsmart-mobile db:migrations:sync
 */
import { copyFile, mkdir, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(__dirname, "..");
const mobileMigrations = join(mobileRoot, "supabase", "migrations");
const aiMigrations = join(mobileRoot, "..", "leadsmartai", "supabase", "migrations");

async function main() {
  await mkdir(mobileMigrations, { recursive: true });
  const files = (await readdir(aiMigrations)).filter((f) => f.endsWith(".sql"));
  for (const f of files) {
    await copyFile(join(aiMigrations, f), join(mobileMigrations, f));
  }
  console.log(`Synced ${files.length} migration files from apps/leadsmartai/supabase/migrations`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
