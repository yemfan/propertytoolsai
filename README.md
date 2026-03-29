# Propertytoolsai (monorepo)

| Common name | Folder |
|-------------|--------|
| PropertyToolsAI (public lead-gen) | `apps/propertytoolsai` |
| LeadSmart AI (CRM / automation) | `apps/leadsmartai` |
| LeadSmart mobile | `apps/leadsmart-mobile` |

Shared packages: **`packages/shared`**, **`packages/api-client`**, **`packages/ui/navigation/`**. See **`packages/ui/navigation/README.md`**.

## Property Tools app — environment

Secrets live in **`apps/propertytoolsai/.env.local`** (not in the repo root).

- Tracked template: **`apps/propertytoolsai/.env.example`**
- Details: **`apps/propertytoolsai/ENV.md`**

```bash
cd apps/propertytoolsai
copy .env.example .env.local
```

## Dev

From repo root (pnpm):

```bash
pnpm run dev:propertytoolsai
pnpm run dev:leadsmartai
pnpm run dev:mobile
```

## Migration smoke tests (Supabase)

From repo root, with `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in each app’s `.env.local`:

```bash
pnpm run smoke:db:all
```

Runs all `smoke:*` migration checks for **leadsmartai** and **propertytoolsai** (does **not** include `smoke:lead-score`, which needs a lead UUID). Individual scripts are listed in each app’s `package.json`. After applying **`20260319_bundle_all.sql`**, you can verify with:

```bash
pnpm run smoke:20260319-schema -w leadsmartai
pnpm run smoke:20260319-schema -w propertytoolsai
```

### One-shot: `20250319_*` SQL migrations

If you have **not** already applied the individual files under `apps/*/supabase/migrations/20250319_*.sql`, you can run the combined script once:

- **`apps/leadsmartai/supabase/migrations/20250319_bundle_all.sql`**
- **`apps/propertytoolsai/supabase/migrations/20250319_bundle_all.sql`** (same contents)

Paste into the Supabase SQL Editor (or use the CLI). It **does not** include `20250319_reset_all_app_data.sql` (destructive wipe) or the older split `lead_followups` / `lead_engagement` files (superseded by `leads_followups_and_engagement_all` inside the bundle).

### One-shot: `20260319_*` SQL migrations

Combined file (same path in both apps):

- **`apps/leadsmartai/supabase/migrations/20260319_bundle_all.sql`**
- **`apps/propertytoolsai/supabase/migrations/20260319_bundle_all.sql`**

Includes usage limits, CMA daily usage, **`tasks` via `tasks_schema_compat`** (skips redundant `tasks.sql` / `tasks_ensure_exists.sql`), performance indexes, daily briefings ( **`agent_id` matches `agents.id`** — uuid or bigint), dashboard drill-down indexes. Run **after** the `20250319` bundle and other earlier migrations.
