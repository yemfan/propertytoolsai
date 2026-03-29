/**
 * Root `pnpm run build` entry for monorepo.
 *
 * - Local / non-Vercel: `clean:next` + `turbo build` (unchanged behavior).
 * - Vercel with Root Directory = repo root: build with `NEXT_DIST_IN_MONOREPO_ROOT=1` so
 *   `.next` is written **directly** at `<repo>/.next` (correct output file tracing — copying
 *   `apps/<app>/.next` → repo root breaks traces and can yield `ENOENT … /node_modules/...`).
 *   If the repo-root build is missing a manifest, fall back to copying from `apps/<app>/.next`.
 *
 * Set in Vercel → Environment Variables (per project):
 *   VERCEL_MONOREPO_APP=leadsmartai | leadsmart-ai | propertytoolsai | property-tools
 *
 * If unset, we try to infer from VERCEL_PROJECT_NAME and deployment URLs.
 */
import { execSync } from "node:child_process";
import { cpSync, existsSync, readdirSync, rmSync } from "node:fs";
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

function canonicalApp(explicit) {
  const e = (explicit || "").trim();
  if (e === "leadsmartai" || e === "leadsmart-ai") return "leadsmartai";
  if (e === "propertytoolsai" || e === "property-tools") return "propertytoolsai";
  return null;
}

function resolveMonorepoApp() {
  const explicit = process.env.VERCEL_MONOREPO_APP?.trim();
  const canon = canonicalApp(explicit || "");
  if (canon) return canon;
  if (explicit) {
    console.error(
      `[vercel-monorepo-root-build] Invalid VERCEL_MONOREPO_APP="${explicit}". Use leadsmartai, leadsmart-ai, propertytoolsai, or property-tools.`,
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

  if (compact.includes("leadsmart")) return "leadsmartai";
  if (compact.includes("propertytools")) return "propertytoolsai";

  return null;
}

if (process.env.VERCEL === "1") {
  const app = resolveMonorepoApp();
  if (!app) {
    console.error(
      [
        "[vercel-monorepo-root-build] Cannot infer which app to build.",
        "Set Vercel → Environment Variables → VERCEL_MONOREPO_APP to one of:",
        "  leadsmartai (or legacy leadsmart-ai)",
        "  propertytoolsai (or legacy property-tools)",
        "Better fix: set Root Directory to apps/leadsmartai or apps/propertytoolsai (see docs/VERCEL.md).",
      ].join("\n"),
    );
    process.exit(1);
  }

  const script =
    app === "leadsmartai"
      ? "build:vercel-leadsmart-root"
      : "build:vercel-propertytoolsai-root";

  const appNextDir = join(root, "apps", app, ".next");
  const repoNextDir = join(root, ".next");
  const appManifest = join(appNextDir, "routes-manifest.json");
  const repoManifest = join(repoNextDir, "routes-manifest.json");

  // Stale repo-root `.next` (e.g. only `cache/` from a crashed NEXT_DIST build) confuses debugging.
  if (existsSync(repoNextDir)) {
    console.log("[vercel-monorepo-root-build] Removing repo .next before build (clean slate)");
    rmSync(repoNextDir, { recursive: true, force: true });
  }

  // With `NEXT_DIST_IN_MONOREPO_ROOT`, output is `<repo>/.next`. A leftover `apps/<app>/.next`
  // (local dev, Turbo cache, or restored build cache) makes `next build` mix two generated
  // `.next/types` trees and TypeScript fails (LayoutRoutes mismatch).
  if (existsSync(appNextDir)) {
    console.log(
      `[vercel-monorepo-root-build] Removing apps/${app}/.next before repo-root dist build (avoid stale types)`,
    );
    rmSync(appNextDir, { recursive: true, force: true });
  }

  console.log(
    `[vercel-monorepo-root-build] VERCEL=1 → pnpm run ${script} (app=${app}, NEXT_DIST_IN_MONOREPO_ROOT=1)`,
  );
  // Build straight into <repo>/.next so NFT traces match Vercel’s project root (do not rely on cpSync).
  run(`pnpm run ${script}`, {
    NEXT_DIST_IN_MONOREPO_ROOT: "1",
    NEXT_BUILD_OUTPUT_AT_MONOREPO_ROOT: "",
  });

  if (existsSync(repoManifest)) {
    console.log("[vercel-monorepo-root-build] OK:", repoManifest);
    process.exit(0);
  }

  console.warn(
    "[vercel-monorepo-root-build] No routes-manifest at repo root after NEXT_DIST build — falling back to apps/<app>/.next copy",
  );

  if (!existsSync(appManifest)) {
    console.error(
      "[vercel-monorepo-root-build] Missing",
      appManifest,
      "and",
      repoManifest,
      "— `next build` did not finish. Scroll up for TypeScript / OOM / prerender errors.",
    );
    for (const label of [
      ["repo .next", repoNextDir],
      ["app .next", appNextDir],
    ]) {
      if (existsSync(label[1])) {
        try {
          console.error(
            `[vercel-monorepo-root-build] ${label[0]} exists; top-level entries:`,
            readdirSync(label[1]).slice(0, 20).join(", "),
          );
        } catch {
          /* ignore */
        }
      }
    }
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

  console.log("[vercel-monorepo-root-build] OK (after copy):", repoManifest);
  process.exit(0);
}

run("cross-env TURBO_TELEMETRY_DISABLED=1 pnpm run clean:next");
run(
  "cross-env NODE_OPTIONS=--max-old-space-size=12288 TURBO_TELEMETRY_DISABLED=1 pnpm exec turbo build --concurrency=1",
);
