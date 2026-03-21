# Deploying on Vercel (monorepo)

The repo root `package.json` **`build`** script runs **Turbo for every app** (`property-tools` + `leadsmart-ai`).  
For **Vercel**, each Next.js site should be its **own project** with **Root Directory** set to that app folder — **not** the repository root.

## Critical: Root Directory must be the app folder (fixes `.next` not found)

If Vercel reports:

> The Next.js output directory `.next` was not found at **`/vercel/path0/.next`**

then **Root Directory is set to the repo root** (`/vercel/path0`). Vercel looks for **`.next` next to the project root**. This monorepo puts the build at **`apps/<name>/.next`**, not at **`/.next`**.

**Fix (preferred):**

1. **Vercel** → your project → **Settings** → **General** → **Root Directory**
2. Set **`apps/leadsmart-ai`** (or **`apps/property-tools`** for the other project). **Do not** leave this empty or `.` if you want a working Next.js deploy.
3. **Build & Development** → **Output Directory** → leave **empty** (default).
4. **Build Command** / **Install Command** → leave **empty** so **`apps/<app>/vercel.json`** is used (`cd ../.. && npm ci` and `cd ../.. && npm run build -w …`).

Redeploy (clear build cache once if needed).

**Fix (fallback — if you cannot change Root Directory):** Override **Build Command** — do **not** use the default **`npm run build`** from the repo root (that runs **Turbo** for every workspace and still outputs to **`apps/<app>/.next`**, not **`/.next`**). Use one of:

- **`npm run build:vercel-leadsmart-root`** (leadsmart-ai Vercel project only)
- **`npm run build:vercel-property-tools-root`** (property-tools Vercel project only)

Those root scripts set **`NEXT_BUILD_OUTPUT_AT_MONOREPO_ROOT=1`** and **`npm run build -w …`** for **one** app so **`.next`** lands at **`/vercel/path0/.next`**. **Only use** the script that matches that project. Prefer fixing **Root Directory** to **`apps/<app>`** instead.

**Alternative:** Set **`NEXT_BUILD_OUTPUT_AT_MONOREPO_ROOT=1`** in Vercel env and **Build Command** to **`npm run build -w leadsmart-ai`** (or **`property-tools`**) — same idea; the **`build:vercel-*-root`** scripts bundle that for you.

## Option A — Recommended: one Vercel project per app

1. **Root Directory** = **`apps/leadsmart-ai`** (or **`apps/property-tools`**).
2. Leave **Install Command** / **Build Command** **empty** in the dashboard so **`apps/<app>/vercel.json`** applies:
   - `installCommand`: `cd ../.. && npm ci`
   - `buildCommand`: `cd ../.. && npm run build -w <workspace-name>`

The build log should **not** show `turbo build` from the repo root unless you intend to build everything.

### “Routes Manifest Could Not Be Found” / “Output Directory” / other `.next` errors

Vercel shows this when it **cannot read** `routes-manifest.json` inside the Next build output — almost always because **`.next` is missing, empty, or in the wrong place** (same fix as **`path0/.next` not found** above).

**Checklist:**

1. **Scroll up** in the deploy log — if **`next build` failed** (TypeScript, OOM, etc.), fix that first; the Routes Manifest error is often a **follow-on**.
2. **Root Directory** = **`apps/leadsmart-ai`** or **`apps/property-tools`** (not the monorepo root). **Output Directory** in the dashboard = **empty**.
3. If Root Directory **must** stay the repo root, set **`NEXT_BUILD_OUTPUT_AT_MONOREPO_ROOT=1`** for that project only (see **Critical** section above). If Root Directory is **`apps/<app>`**, **do not** set that variable — it would move `.next` to the repo root while Vercel still expects **`apps/<app>/.next`**.
4. **Turborepo** — Root **`turbo.json`** `build.outputs` includes `.next/**`, `!.next/cache/**`, and `dist/**`. If you run **`turbo build`** from the repo root, use **`npx turbo run build --filter=leadsmart-ai`** when you only need one app.
5. After changing settings, **Redeploy** (optionally **Clear build cache**).

## Option B — Repo-root Vercel project (not recommended for Next.js)

If **Root Directory** is the **repository root**, Vercel still expects **`.next` at `/vercel/path0/.next`**, but a normal workspace **`next build`** writes to **`apps/<app>/.next`**. That mismatch causes the error above.

**Do not** use a repo-root Root Directory for these Next apps unless you must. Prefer **Option A** (Root Directory = **`apps/leadsmart-ai`** or **`apps/property-tools`**).

If Root Directory **must** stay the repo root:

- **Install Command:** `npm ci` (or your usual root install).
- **Build Command:** **`npm run build:vercel-leadsmart-root`** or **`npm run build:vercel-property-tools-root`** (see root **`package.json`**). **Do not** use **`npm run build`** — that invokes **Turbo** and does not fix the **`.next`** path for a single app.
- **Environment:** **`NEXT_BUILD_OUTPUT_AT_MONOREPO_ROOT=1`** is already applied by those scripts; you can also set it in the dashboard if you prefer a custom command.

If you **can** set **Root Directory** to **`apps/leadsmart-ai`**, you only need **`vercel.json`** there (`cd ../.. && npm run build -w …`) — no **`build:vercel-*-root`** scripts.

## Node.js version

The repo root **`package.json`** sets **`engines.node` to `20.x`** so Vercel uses **Node 20 LTS** for installs and builds (avoids occasional Next.js / tooling issues on newer runtimes). If your machine runs Node 24+, you may see `EBADENGINE` from npm — use **nvm `20`** locally or ignore the warning.

## Build script (`apps/*/scripts/next-build.mjs`)

Each app runs **`node ./scripts/next-build.mjs`** (see that app’s **`package.json`** **`build`** script). The script is **self-contained under the app folder** (it does **not** call repo root `scripts/next-build-with-heap.mjs`) so Vercel **Root Directory** = `apps/<name>` never misses files outside that tree. It sets **`NODE_OPTIONS=--max-old-space-size=…`**, resolves the **`next`** CLI from **`node_modules`**, and runs **`next build`** with **`cwd`** = the app. Override heap with **`NEXT_BUILD_HEAP_MB`** if needed.

The repo root still has **`scripts/next-build-with-heap.mjs`** for reference / manual use; the deployed apps do not depend on it.

**Bundler:** Next.js 16 defaults to **Turbopack** for `next build`. **`next-build.mjs` does not force `--webpack` on Vercel** — webpack + **`@tailwindcss/postcss`** + native **`lightningcss` / `@tailwindcss/oxide`** often fails in CI with generic **“Build failed because of webpack errors”** / `require-hook` traces. Logs show **`bundler=turbopack`** unless you set **`NEXT_BUILD_USE_WEBPACK=1`** (opt-in webpack for debugging).

**Tailwind v4 + webpack:** Theme tokens live in **`app/globals.css`** via **`@theme`** (not **`@config` → `tailwind.config.ts`**) so PostCSS does not load TypeScript during the CSS pipeline — avoids **Linux/Vercel-only webpack** failures around config resolution.

**Install:** Keep **`tailwindcss`**, **`postcss`**, **`@tailwindcss/postcss`**, and **`lightningcss`** in **`dependencies`** (not only `devDependencies`) so `npm ci` / production-oriented installs always have them for `next build`. **Do not** list Tailwind packages in **`serverExternalPackages`** — that can break PostCSS/Turbopack resolution and show **`globals.css` → `layout.tsx`** import traces with no clear error.

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
2. **`Cannot find module '…lightningcss…'` or `…tailwindcss-oxide.linux-x64-gnu.node'`** — The repo root `package.json` includes **`optionalDependencies`** for Linux **`lightningcss-*`** and **`@tailwindcss/oxide-linux-x64-gnu`** / **`musl`** (same versions as Tailwind 4.2.x) so `npm ci` on Vercel installs the native binaries. Ensure that commit is deployed and **Redeploy** (clear build cache if needed).
3. **Heap / OOM** — Each app’s **`next.config.js`** lowers **static generation concurrency** and enables **webpack memory optimizations**. The **`build` script** runs **`apps/<app>/scripts/next-build.mjs`**, which sets **`NODE_OPTIONS`** before spawning `next build`. `apps/*/vercel.json` can also set heap when Root Directory is that app. The **root** `package.json` scripts set `NODE_OPTIONS` for **`turbo build`**. You can mirror **`NODE_OPTIONS`** in **Project → Settings → Environment Variables** if needed.
4. **Build log still shows `cross-env … next build`** — That is the **old** script. Fix: (a) confirm the **commit SHA** on the deployment matches GitHub `main`; (b) **Redeploy** with **Clear cache**; (c) in **Project → Settings → General**, ensure **Build Command** is **empty** (use `apps/<app>/vercel.json`) or `cd ../.. && npm run build -w <workspace>` — **remove** any manual `cross-env …` override. A current log should show **`[next-build] appRoot=...`** before Next runs.
5. **Turbo building both apps** — If the log shows `leadsmart-ai:build:` and `property-tools:build:`, the project is running the **root** `turbo build`. To build **only** `leadsmart-ai`, use **Root Directory** `apps/leadsmart-ai` (Option A above) or **Build Command** `npm run build:leadsmart` from the repo root (Option B).

## Understanding build logs

- **`https://turborepo.dev/docs/telemetry`** — Turborepo’s own telemetry notice (separate from Next.js). The root `npm run build` sets `TURBO_TELEMETRY_DISABLED=1` to reduce noise.
- **`Packages in scope: … 9 packages`** — Turbo is building **all** workspace packages that have a `build` task (`@repo/*`, `leadsmart-ai`, `property-tools`). To build **only one app**, use **Root Directory** `apps/leadsmart-ai` and `apps/leadsmart-ai/vercel.json`, or **Build Command** `npm run build:leadsmart` from the repo root.
- **`Remote caching unavailable (Authentication failed — check TURBO_TOKEN)`** — Normal if you haven’t connected [Vercel Remote Cache](https://vercel.com/docs/monorepos/remote-caching) or a Turbo token. Builds still succeed; only distributed cache is skipped.
- **`leadsmart-ai:build: - Environments: .env.production`** — Next.js is loading the committed `apps/leadsmart-ai/.env.production` (e.g. `NEXT_TELEMETRY_DISABLED=1`). Secrets stay in Vercel env, not in git.
