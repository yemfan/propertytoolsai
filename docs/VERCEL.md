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

## Node.js version

The repo root **`package.json`** sets **`engines.node` to `20.x`** so Vercel uses **Node 20 LTS** for installs and builds (avoids occasional Next.js / tooling issues on newer runtimes). If your machine runs Node 24+, you may see `EBADENGINE` from npm — use **nvm `20`** locally or ignore the warning.

## Build script (`apps/*/scripts/next-build.mjs`)

Each app runs **`node ./scripts/next-build.mjs`** (see that app’s **`package.json`** **`build`** script). The script is **self-contained under the app folder** (it does **not** call repo root `scripts/next-build-with-heap.mjs`) so Vercel **Root Directory** = `apps/<name>` never misses files outside that tree. It sets **`NODE_OPTIONS=--max-old-space-size=…`**, resolves the **`next`** CLI from **`node_modules`**, and runs **`next build`** with **`cwd`** = the app. Override heap with **`NEXT_BUILD_HEAP_MB`** if needed.

The repo root still has **`scripts/next-build-with-heap.mjs`** for reference / manual use; the deployed apps do not depend on it.

**Bundler:** Next.js 16 defaults to **Turbopack** for `next build`. On **Vercel** (`VERCEL=1`), each app’s **`next-build.mjs`** appends **`--webpack`** so production builds use **webpack** (more consistent on Vercel’s Linux runners). Logs show **`bundler=webpack`** or **`bundler=turbopack`**. To force webpack anywhere: **`NEXT_BUILD_USE_WEBPACK=1`**. To force Turbopack on Vercel: **`NEXT_BUILD_USE_WEBPACK=0`**.

**Tailwind v4 + webpack:** Theme tokens live in **`app/globals.css`** via **`@theme`** (not **`@config` → `tailwind.config.ts`**) so PostCSS does not load TypeScript during the CSS pipeline — avoids **Linux/Vercel-only webpack** failures around config resolution.

## Environment variables

Add the same variables as `apps/<app>/.env.local` in **Vercel → Settings → Environment Variables** (Production / Preview). Do not commit secrets.

Optional (recommended on Vercel):

| Variable | Purpose |
|----------|---------|
| `TURBO_TELEMETRY_DISABLED=1` | Quiets Turborepo’s telemetry banner (root `build` also sets this via `cross-env`). |
| `NEXT_TELEMETRY_DISABLED=1` | Quiets Next.js telemetry; apps also load this from committed `.env.production`. |

## Fewer pages at **build** time (`leadsmart-ai` + `property-tools`)

Both apps previously prerendered **hundreds to thousands** of static HTML routes (local SEO keyword matrix, and on `property-tools` programmatic `/tool/...` pages), which can **OOM** Vercel’s build VM even with a large `NODE_OPTIONS` heap.

Heavy routes use **`generateStaticParams()` → `[]`**, **`revalidate` (ISR)**, and (on `property-tools` `/tool/...`) **`dynamicParams: true`** so URLs are **rendered on first request** and cached at the edge — not all at build time. **Sitemaps** still list those URLs for SEO.

## Troubleshooting `next build` exit code 1

The lines at the **bottom** of the log (`npm error Lifecycle script build failed`, `command sh -c next build`) only mean Next failed — they do **not** show the cause.

1. Scroll **up** in the Vercel build log and find the **first** message that is not `npm error` — e.g. `Failed to compile`, `Type error`, `Error occurred prerendering`, `Cannot find module '…lightningcss…'`, `JavaScript heap out of memory`, `Killed`, etc.
2. **`Cannot find module '…lightningcss.linux-x64-gnu.node'`** — The repo root `package.json` includes `optionalDependencies` for Linux `lightningcss` binaries so `npm ci` on Vercel (Linux) installs them. Ensure that commit is deployed and run **Redeploy** (clear build cache if needed).
3. **Heap / OOM** — Each app’s **`next.config.js`** lowers **static generation concurrency** and enables **webpack memory optimizations**. The **`build` script** runs **`apps/<app>/scripts/next-build.mjs`**, which sets **`NODE_OPTIONS`** before spawning `next build`. `apps/*/vercel.json` can also set heap when Root Directory is that app. The **root** `package.json` scripts set `NODE_OPTIONS` for **`turbo build`**. You can mirror **`NODE_OPTIONS`** in **Project → Settings → Environment Variables** if needed.
4. **Build log still shows `cross-env … next build`** — That is the **old** script. Fix: (a) confirm the **commit SHA** on the deployment matches GitHub `main`; (b) **Redeploy** with **Clear cache**; (c) in **Project → Settings → General**, ensure **Build Command** is **empty** (use `apps/<app>/vercel.json`) or `cd ../.. && npm run build -w <workspace>` — **remove** any manual `cross-env …` override. A current log should show **`[next-build] appRoot=...`** before Next runs.
5. **Turbo building both apps** — If the log shows `leadsmart-ai:build:` and `property-tools:build:`, the project is running the **root** `turbo build`. To build **only** `leadsmart-ai`, use **Root Directory** `apps/leadsmart-ai` (Option A above) or **Build Command** `npm run build:leadsmart` from the repo root (Option B).

## Understanding build logs

- **`https://turborepo.dev/docs/telemetry`** — Turborepo’s own telemetry notice (separate from Next.js). The root `npm run build` sets `TURBO_TELEMETRY_DISABLED=1` to reduce noise.
- **`Packages in scope: … 9 packages`** — Turbo is building **all** workspace packages that have a `build` task (`@repo/*`, `leadsmart-ai`, `property-tools`). To build **only one app**, use **Root Directory** `apps/leadsmart-ai` and `apps/leadsmart-ai/vercel.json`, or **Build Command** `npm run build:leadsmart` from the repo root.
- **`Remote caching unavailable (Authentication failed — check TURBO_TOKEN)`** — Normal if you haven’t connected [Vercel Remote Cache](https://vercel.com/docs/monorepos/remote-caching) or a Turbo token. Builds still succeed; only distributed cache is skipped.
- **`leadsmart-ai:build: - Environments: .env.production`** — Next.js is loading the committed `apps/leadsmart-ai/.env.production` (e.g. `NEXT_TELEMETRY_DISABLED=1`). Secrets stay in Vercel env, not in git.
