/**
 * Root `npm run build` entry for monorepo.
 *
 * - Local / non-Vercel: `clean:next` + `turbo build` (unchanged behavior).
 * - Vercel with Root Directory = repo root: build ONE Next app and emit `.next`
 *   at the monorepo root (see `NEXT_BUILD_OUTPUT_AT_MONOREPO_ROOT` in each app's
 *   `next.config.js`). Default `turbo build` leaves output under `apps/<app>/.next`,
 *   which breaks Vercel's expectation of `/vercel/path0/.next`.
 *
 * Set in Vercel → Environment Variables (per project):
 *   VERCEL_MONOREPO_APP=leadsmart-ai   OR   property-tools
 *
 * If unset, we try to infer from VERCEL_PROJECT_NAME (dashboard project name).
 */
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

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

  const name = (process.env.VERCEL_PROJECT_NAME || "").toLowerCase();
  if (name.includes("leadsmart")) return "leadsmart-ai";
  if (name.includes("property-tools") || name.includes("propertytools")) {
    return "property-tools";
  }

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
        "Or rename the Vercel project so VERCEL_PROJECT_NAME contains \"leadsmart\" or \"property-tools\".",
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
  process.exit(0);
}

run("cross-env TURBO_TELEMETRY_DISABLED=1 npm run clean:next");
run(
  "cross-env NODE_OPTIONS=--max-old-space-size=12288 TURBO_TELEMETRY_DISABLED=1 npx turbo build --concurrency=1",
);
