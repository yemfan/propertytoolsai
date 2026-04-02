/**
 * Run one or more `.sql` files against the linked Supabase project (remote Postgres).
 * Does not update `supabase_migrations.schema_migrations` — use for idempotent DDL
 * (`IF NOT EXISTS`) or when `supabase db push` cannot run (duplicate migration versions).
 *
 * Usage (from apps/leadsmartai):
 *   node ./scripts/apply-supabase-sql-remote.mjs supabase/migrations/20260327120000_user_profiles_avatar_url.sql
 *
 * Requires `apps/leadsmart-mobile` to be linked (`pnpm db:link` in that package).
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const leadsmartaiRoot = join(__dirname, "..");
const mobileRoot = join(leadsmartaiRoot, "..", "leadsmart-mobile");

const files = process.argv.slice(2).filter((a) => !a.startsWith("-"));
if (files.length === 0) {
  console.error("Usage: node apply-supabase-sql-remote.mjs <file.sql> [file2.sql ...]");
  process.exit(1);
}

for (const rel of files) {
  const abs = resolve(leadsmartaiRoot, rel);
  if (!existsSync(abs)) {
    console.error(`File not found: ${abs}`);
    process.exit(1);
  }
  const fromMobile = relative(mobileRoot, abs).replace(/\\/g, "/");
  console.log(`\nApplying: ${abs}\n`);
  try {
    execSync(
      `npx supabase db query --linked -f ${JSON.stringify(fromMobile)} --agent=no`,
      { cwd: mobileRoot, stdio: "inherit", shell: true }
    );
  } catch (e) {
    process.exit(typeof e?.status === "number" ? e.status : 1);
  }
}

console.log("\nDone.\n");
