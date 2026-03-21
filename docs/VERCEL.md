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
