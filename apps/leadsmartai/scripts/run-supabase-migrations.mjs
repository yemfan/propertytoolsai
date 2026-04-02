/**
 * Applies pending SQL migrations in this repo to the linked Supabase project.
 *
 * Migrations live in `apps/leadsmartai/supabase/migrations/` (source of truth).
 * The Supabase CLI project link lives under `apps/leadsmart-mobile/supabase/`
 * (same project ref as LeadSmart web). This script:
 *   1. Copies migration files → leadsmart-mobile (keeps mobile in sync)
 *   2. Runs `supabase db push --yes` there
 *
 * Usage (from repo root):
 *   pnpm --filter leadsmartai db:migrate:remote
 *
 * Prereqs: once per machine, from `apps/leadsmart-mobile`: `pnpm db:link`
 * (`npx supabase` + Supabase login / access token).
 *
 * If `db push` fails with duplicate key on `schema_migrations` (common when many
 * files share the same date prefix, e.g. `20250319_*.sql`), the remote DB may have
 * been evolved outside this history. For a single idempotent migration file, use:
 *   node ./scripts/apply-supabase-sql-remote.mjs supabase/migrations/<file>.sql
 */

import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const leadsmartaiRoot = join(__dirname, "..");
const mobileRoot = join(leadsmartaiRoot, "..", "leadsmart-mobile");

function run(cmd, cwd) {
  console.log(`\n> ${cmd} (cwd: ${cwd})\n`);
  execSync(cmd, { cwd, stdio: "inherit", shell: true });
}

try {
  run("node ./scripts/sync-migrations-from-leadsmartai.mjs", mobileRoot);
  run("npx supabase db push --yes", mobileRoot);
  console.log("\nDone. Remote database migrations table is in sync with local files.\n");
} catch (e) {
  console.error(
    "\nIf push failed due to migration history conflicts, sync is still done (mobile mirrors leadsmartai).\n" +
      "Apply idempotent SQL with: node ./scripts/apply-supabase-sql-remote.mjs supabase/migrations/<file>.sql\n"
  );
  process.exit(typeof e?.status === "number" ? e.status : 1);
}
