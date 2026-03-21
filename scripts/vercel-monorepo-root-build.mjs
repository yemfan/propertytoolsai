/**
 * Root `npm run build` entry for monorepo.
 *
 * - Local / non-Vercel: `clean:next` + `turbo build` (unchanged behavior).
 * - Vercel with Root Directory = repo root: build ONE Next app and emit `.next`
 *   at the monorepo root (see `NEXT_DIST_IN_MONOREPO_ROOT` in each app's
 *   `next.config.js`). Default `turbo build` leaves output under `apps/<app>/.next`,
 *   which breaks Vercel's expectation of `/vercel/path0/.next`.
 *
 * Set in Vercel → Environment Variables (per project):
 *   VERCEL_MONOREPO_APP=leadsmart-ai   OR   property-tools
 *
 * If unset, we try to infer from VERCEL_PROJECT_NAME (dashboard project name)
 * and deployment URLs (so "Property Tools AI" / property.tools match property-tools).
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

/** Lowercase and strip separators so "Property Tools AI" → "propertytoolsai". */
function normalizeForMatch(s) {
  return (s || "").toLowerCase().replace(/[\s.\\/_-]+/g, "");
}

function run(cmd) {
  execSync(cmd, { stdio: "inherit", cwd: root, env: process.env, shell: true });
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

  console.log(`[vercel-monorepo-root-build] VERCEL=1 → npm run ${script} (app=${app})`);
  run(`npm run ${script}`);
  const repoNextManifest = join(root, ".next", "routes-manifest.json");
  if (!existsSync(repoNextManifest)) {
    console.error(
      `[vercel-monorepo-root-build] Expected ${repoNextManifest} after repo-root build. ` +
        "If Root Directory is apps/<app>, do not use repo-root builds — set Root Directory to apps/<app> and use apps/<app>/vercel.json.",
    );
    process.exit(1);
  }
  process.exit(0);
}

run("cross-env TURBO_TELEMETRY_DISABLED=1 npm run clean:next");
run(
  "cross-env NODE_OPTIONS=--max-old-space-size=12288 TURBO_TELEMETRY_DISABLED=1 npx turbo build --concurrency=1",
);
