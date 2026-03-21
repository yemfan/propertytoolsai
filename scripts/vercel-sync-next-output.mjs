/**
 * After `npm run build -w <app>` from the monorepo root on Vercel, Next may write
 * `apps/<app>/.next/` while the deployment step looks for `.next/` at the *repository*
 * root (`/vercel/path0/.next` when Root Directory is unset or the repo root).
 *
 * When `routes-manifest.json` exists under `apps/<app>/.next` but not at `<repo>/.next`,
 * copy the full `.next` tree to the repo root so Vercel's Next.js builder can find it.
 *
 * Skips when NEXT_DIST_IN_MONOREPO_ROOT=1 (build already emits at repo root) or not VERCEL.
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

if (process.env.NEXT_DIST_IN_MONOREPO_ROOT === "1") {
  console.log("[vercel-sync-next-output] NEXT_DIST_IN_MONOREPO_ROOT=1 — output already at repo root.");
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
