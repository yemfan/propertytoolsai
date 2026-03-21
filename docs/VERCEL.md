# Deploying on Vercel (monorepo)

The repo root `package.json` **`build`** script runs **Turbo for every app** (`property-tools` + `leadsmart-ai`).  
A Vercel project that uses the **repository root** as its Root Directory will run that full monorepo build.

## Option A — Recommended: one Vercel project per app

1. **Vercel** → Project → **Settings** → **General** → **Root Directory**
2. Set to **`apps/leadsmart-ai`** (or **`apps/property-tools`** for the other site).
3. Leave **Install Command** / **Build Command** empty so **`apps/<app>/vercel.json`** applies:
   - `installCommand`: `cd ../.. && npm ci`
   - `buildCommand`: `cd ../.. && npm run build -w <workspace-name>`

Redeploy. The build log should **not** show `turbo build` from the repo root unless you intend to build everything.

## Option B — Root Directory stays `.` (repo root)

Override in **Project → Settings → Build & Development**:

| Field | Value |
|--------|--------|
| **Install Command** | `npm ci` |
| **Build Command** | `npm run build:leadsmart` |

(`build:leadsmart` is defined in the root `package.json` and runs only `leadsmart-ai`.)

For **property-tools** only: `npm run build:property-tools`.

## Environment variables

Add the same variables as `apps/<app>/.env.local` in **Vercel → Settings → Environment Variables** (Production / Preview). Do not commit secrets.

Optional (recommended on Vercel):

| Variable | Purpose |
|----------|---------|
| `TURBO_TELEMETRY_DISABLED=1` | Quiets Turborepo’s telemetry banner (root `build` also sets this via `cross-env`). |
| `NEXT_TELEMETRY_DISABLED=1` | Quiets Next.js telemetry; apps also load this from committed `.env.production`. |

## Understanding build logs

- **`https://turborepo.dev/docs/telemetry`** — Turborepo’s own telemetry notice (separate from Next.js). The root `npm run build` sets `TURBO_TELEMETRY_DISABLED=1` to reduce noise.
- **`Packages in scope: … 9 packages`** — Turbo is building **all** workspace packages that have a `build` task (`@repo/*`, `leadsmart-ai`, `property-tools`). To build **only one app**, use **Root Directory** `apps/leadsmart-ai` and `apps/leadsmart-ai/vercel.json`, or **Build Command** `npm run build:leadsmart` from the repo root.
- **`Remote caching unavailable (Authentication failed — check TURBO_TOKEN)`** — Normal if you haven’t connected [Vercel Remote Cache](https://vercel.com/docs/monorepos/remote-caching) or a Turbo token. Builds still succeed; only distributed cache is skipped.
- **`leadsmart-ai:build: - Environments: .env.production`** — Next.js is loading the committed `apps/leadsmart-ai/.env.production` (e.g. `NEXT_TELEMETRY_DISABLED=1`). Secrets stay in Vercel env, not in git.
