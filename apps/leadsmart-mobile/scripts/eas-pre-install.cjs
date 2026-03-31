/**
 * EAS Build runs this before `pnpm install`. Ensures Corepack is on and that the
 * monorepo root (pnpm-workspace.yaml + lockfile) is present in the upload — if
 * those are missing, EAS can mis-detect the package manager or fail workspace installs.
 *
 * @see https://github.com/expo/eas-cli/issues/2978
 */
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const appDir = process.cwd();
const monorepoRoot = path.resolve(appDir, "../..");

function mustExist(relFromRoot, label) {
  const abs = path.join(monorepoRoot, relFromRoot);
  if (!fs.existsSync(abs)) {
    console.error(`[eas-pre-install] Missing ${label}: ${abs}`);
    console.error(
      "[eas-pre-install] Ensure the Expo project uses the git repo root (or full monorepo) in the archive — pnpm-workspace.yaml and pnpm-lock.yaml must not be excluded."
    );
    process.exit(1);
  }
}

try {
  execSync("corepack enable", { stdio: "inherit", env: process.env });
} catch (e) {
  console.warn("[eas-pre-install] corepack enable warning (non-fatal):", e?.message || e);
}

mustExist("pnpm-workspace.yaml", "pnpm workspace manifest");
mustExist("pnpm-lock.yaml", "pnpm lockfile");

console.log("[eas-pre-install] OK — monorepo root:", monorepoRoot);
