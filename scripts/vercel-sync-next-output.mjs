/**
 * Ensures `routes-manifest.json` exists where Vercel's Next builder looks:
 * often `<repo>/.next/` even when `next build` wrote `apps/<workspace>/.next/`.
 *
 * If `<repo>/.next/routes-manifest.json` is missing but the app build exists,
 * copies the full `apps/<workspace>/.next` tree to `<repo>/.next`.
 *
 * IMPORTANT: Do not use `process.cwd()` alone — Vercel sometimes runs hooks with a
 * different cwd than the monorepo root. We resolve the repo root from this script's
 * path (`scripts/…` → parent = repo root) and walk up from cwd as a fallback.
 */
import { existsSync, cpSync, rmSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspace = process.argv[2];
if (!workspace) {
  console.error("[vercel-sync-next-output] Usage: node vercel-sync-next-output.mjs <workspace-name>");
  process.exit(1);
}

if (process.env.VERCEL !== "1") {
  process.exit(0);
}

const scriptDir = dirname(fileURLToPath(import.meta.url));

/**
 * @returns {string} Directory that contains `apps/<workspace>/package.json`
 */
function findMonorepoRoot(ws) {
  const fromScript = resolve(scriptDir, "..");
  if (existsSync(join(fromScript, "apps", ws, "package.json"))) {
    return fromScript;
  }
  let dir = resolve(process.cwd());
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, "apps", ws, "package.json"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  console.warn(
    "[vercel-sync-next-output] Could not find apps/" +
      ws +
      "/package.json — using script parent as repo root:",
    fromScript,
  );
  return fromScript;
}

function logDirHint(label, dir) {
  if (!existsSync(dir)) {
    console.error(`[vercel-sync-next-output] ${label}: (missing) ${dir}`);
    return;
  }
  try {
    const st = statSync(dir);
    if (!st.isDirectory()) {
      console.error(`[vercel-sync-next-output] ${label}: (not a directory) ${dir}`);
      return;
    }
    const entries = readdirSync(dir);
    const hasManifest = entries.includes("routes-manifest.json");
    console.error(
      `[vercel-sync-next-output] ${label}: ${dir} (${entries.length} entries, routes-manifest=${hasManifest})`,
    );
  } catch (e) {
    console.error(`[vercel-sync-next-output] ${label}: ${dir} (${String(e?.message ?? e)})`);
  }
}

const root = findMonorepoRoot(workspace);
const appManifest = join(root, "apps", workspace, ".next", "routes-manifest.json");
const repoManifest = join(root, ".next", "routes-manifest.json");
const appNextDir = join(root, "apps", workspace, ".next");
const repoNextDir = join(root, ".next");

console.log("[vercel-sync-next-output] repoRoot=", root, "workspace=", workspace, "cwd=", process.cwd());

if (existsSync(repoManifest)) {
  console.log("[vercel-sync-next-output] OK:", repoManifest);
  process.exit(0);
}

if (existsSync(appManifest)) {
  if (existsSync(repoNextDir)) {
    rmSync(repoNextDir, { recursive: true, force: true });
  }
  cpSync(appNextDir, repoNextDir, { recursive: true });
  console.log("[vercel-sync-next-output] Copied", appNextDir, "->", repoNextDir);
  if (!existsSync(repoManifest)) {
    console.error("[vercel-sync-next-output] Copy failed; still missing:", repoManifest);
    logDirHint("repo .next", repoNextDir);
    process.exit(1);
  }
  process.exit(0);
}

// NEXT_DIST_IN_MONOREPO_ROOT=1 should write to <root>/.next — manifest might be missing if build failed mid-flight
if (existsSync(repoNextDir) && !existsSync(repoManifest)) {
  console.error(
    "[vercel-sync-next-output] Found",
    repoNextDir,
    "but routes-manifest.json is missing — next build may have failed or exited before finishing.",
  );
  logDirHint("repo .next", repoNextDir);
}

console.error("[vercel-sync-next-output] Missing routes-manifest.json in both locations:");
console.error("  ", repoManifest);
console.error("  ", appManifest);
logDirHint("apps/<ws>/.next", appNextDir);
logDirHint("repo .next", repoNextDir);

console.error(
  [
    "",
    "[vercel-sync-next-output] Fix:",
    "  1) Scroll up — if `next build` failed (TS, OOM, prerender), fix that first; missing routes-manifest usually follows a failed build.",
    "  2) Preferred: Vercel → Root Directory = apps/" + workspace + " → leave Build Command empty (apps/" + workspace + "/vercel.json runs workspace build only; no sync step).",
    "  3) Remove dashboard env NEXT_DIST_IN_MONOREPO_ROOT and NEXT_BUILD_OUTPUT_AT_MONOREPO_ROOT unless you use repo-root build (they break apps/<app>/.next).",
    "  4) Repo-root only: Root Directory = repo root, Build Command = `npm run build`, set VERCEL_MONOREPO_APP=" + workspace + " — vercel-monorepo-root-build copies apps/" + workspace + "/.next → repo .next (this sync script is optional).",
    "  5) If your dashboard Build Command manually runs this script while Root Directory is apps/" + workspace + ", remove that — it is not needed and can fail after a good build.",
  ].join("\n"),
);

process.exit(1);
