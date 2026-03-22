/**
 * Root `npm run build` entry for monorepo.
 *
 * - Local / non-Vercel: `clean:next` + `turbo build` (unchanged behavior).
 * - Vercel with Root Directory = repo root: build ONE Next app into `apps/<app>/.next`
 *   (default distDir — avoids fragile `NEXT_DIST_IN_MONOREPO_ROOT` partial writes),
 *   then copy the full tree to `<repo>/.next` so `/vercel/path0/.next` exists.
 *
 * Set in Vercel → Environment Variables (per project):
 *   VERCEL_MONOREPO_APP=leadsmart-ai   OR   property-tools
 *
 * If unset, we try to infer from VERCEL_PROJECT_NAME (dashboard project name)
 * and deployment URLs (so "Property Tools AI" / property.tools match property-tools).
 */
import { execSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

/** Lowercase and strip separators so "Property Tools AI" → "propertytoolsai". */
function normalizeForMatch(s) {
  return (s || "").toLowerCase().replace(/[\s.\\/_-]+/g, "");
}

function run(cmd, envOverrides = {}) {
  execSync(cmd, {
    stdio: "inherit",
    cwd: root,
    shell: true,
    env: Object.keys(envOverrides).length ? { ...process.env, ...envOverrides } : process.env,
  });
}

function resolveMonorepoApp() {
  const explicit = process.env.VERCEL_MONOREPO_APP?.trim();
  if (explicit === "leadsmart-ai" || explicit === "property-tools") {
    return explicit;
  }
  if (explicit) {
    console.error(
      `[vercel-monorepo-root-build] Invalid VERCEL_MONOREPO_APP="${explicit}". Use leadsmart-ai or property-tools.`,
    );
    process.exit(1);
  }

  const blobs = [
    process.env.VERCEL_PROJECT_NAME,
    process.env.VERCEL_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_BRANCH_URL,
  ];
  const compact = normalizeForMatch(blobs.filter(Boolean).join(" "));

  // Order: leadsmart first (rare overlap), then property-tools (repo / product names vary a lot).
  if (compact.includes("leadsmart")) return "leadsmart-ai";
  if (compact.includes("propertytools")) return "property-tools";

  return null;
}

if (process.env.VERCEL === "1") {
  const app = resolveMonorepoApp();
  if (!app) {
    console.error(
      [
        "[vercel-monorepo-root-build] Cannot infer which app to build.",
        "Set Vercel → Environment Variables → VERCEL_MONOREPO_APP to one of:",
        "  leadsmart-ai",
        "  property-tools",
        "Or set VERCEL_MONOREPO_APP=property-tools on the Property Tools project (repo-root deploys only).",
        "Better fix: set Root Directory to apps/leadsmart-ai or apps/property-tools (see docs/VERCEL.md).",
      ].join("\n"),
    );
    process.exit(1);
  }

  const script =
    app === "leadsmart-ai"
      ? "build:vercel-leadsmart-root"
      : "build:vercel-property-tools-root";

  const appNextDir = join(root, "apps", app, ".next");
  const repoNextDir = join(root, ".next");
  const appManifest = join(appNextDir, "routes-manifest.json");
  const repoManifest = join(repoNextDir, "routes-manifest.json");

  // Stale repo-root `.next` (e.g. only `cache/` from a crashed NEXT_DIST build) confuses debugging.
  if (existsSync(repoNextDir)) {
    console.log("[vercel-monorepo-root-build] Removing repo .next before build (clean slate)");
    rmSync(repoNextDir, { recursive: true, force: true });
  }

  console.log(`[vercel-monorepo-root-build] VERCEL=1 → npm run ${script} (app=${app})`);
  // Force default distDir under apps/<app>/.next even if Vercel dashboard sets NEXT_DIST_* (avoids partial <root>/.next).
  run(`npm run ${script}`, {
    NEXT_DIST_IN_MONOREPO_ROOT: "",
    NEXT_BUILD_OUTPUT_AT_MONOREPO_ROOT: "",
  });

  if (!existsSync(appManifest)) {
    console.error(
      "[vercel-monorepo-root-build] Missing",
      appManifest,
      "— `next build` did not finish. Scroll up for TypeScript / OOM / prerender errors.",
    );
    console.error(
      "[vercel-monorepo-root-build] Prefer Vercel Root Directory = apps/" + app + " (see docs/VERCEL.md).",
    );
    process.exit(1);
  }

  try {
    if (existsSync(repoNextDir)) {
      rmSync(repoNextDir, { recursive: true, force: true });
    }
    cpSync(appNextDir, repoNextDir, { recursive: true, force: true });
    console.log("[vercel-monorepo-root-build] Copied", appNextDir, "->", repoNextDir);
  } catch (e) {
    console.error("[vercel-monorepo-root-build] Copy to repo .next failed:", e?.message ?? e);
    process.exit(1);
  }

  if (!existsSync(repoManifest)) {
    console.error("[vercel-monorepo-root-build] Still missing after copy:", repoManifest);
    process.exit(1);
  }

  console.log("[vercel-monorepo-root-build] OK:", repoManifest);
  process.exit(0);
}

run("cross-env TURBO_TELEMETRY_DISABLED=1 npm run clean:next");
run(
  "cross-env NODE_OPTIONS=--max-old-space-size=12288 TURBO_TELEMETRY_DISABLED=1 npx turbo build --concurrency=1",
);
