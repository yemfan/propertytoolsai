/**
 * Ensures `routes-manifest.json` exists where Vercel's Next builder looks:
 * often `<repo>/.next/` even when `next build` wrote `apps/<workspace>/.next/`.
 *
 * If `<repo>/.next/routes-manifest.json` is missing but the app build exists,
 * copies the full `apps/<workspace>/.next` tree to `<repo>/.next`.
 *
 * Also handles the case where `NEXT_DIST_IN_MONOREPO_ROOT=1` was set but distDir
 * still landed under `apps/<app>/.next` (env not applied to the Next process).
 */
import { existsSync, cpSync, rmSync } from "node:fs";
import { join } from "node:path";

const workspace = process.argv[2];
if (!workspace) {
  console.error("[vercel-sync-next-output] Usage: node vercel-sync-next-output.mjs <workspace-name>");
  process.exit(1);
}

if (process.env.VERCEL !== "1") {
  process.exit(0);
}

const root = process.cwd();
const appManifest = join(root, "apps", workspace, ".next", "routes-manifest.json");
const repoManifest = join(root, ".next", "routes-manifest.json");

if (existsSync(repoManifest)) {
  console.log("[vercel-sync-next-output] OK:", repoManifest);
  process.exit(0);
}

if (!existsSync(appManifest)) {
  console.error("[vercel-sync-next-output] Missing app build output:", appManifest);
  process.exit(1);
}

const src = join(root, "apps", workspace, ".next");
const dest = join(root, ".next");

if (existsSync(dest)) {
  rmSync(dest, { recursive: true, force: true });
}

cpSync(src, dest, { recursive: true });
console.log("[vercel-sync-next-output] Copied", src, "->", dest);

if (!existsSync(repoManifest)) {
  console.error("[vercel-sync-next-output] Copy failed; still missing:", repoManifest);
  process.exit(1);
}

process.exit(0);
