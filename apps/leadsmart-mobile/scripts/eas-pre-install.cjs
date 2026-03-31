/**
 * EAS Build runs this before package install. Verifies the monorepo root
 * (pnpm-workspace.yaml + lockfile) is in the archive — if those are missing,
 * EAS can mis-detect the package manager or fail workspace installs.
 *
 * We intentionally do NOT run `corepack enable` here: forcing Corepack + a
 * pinned pnpm in eas.json often fails on EAS with "Failed to install pnpm".
 * The sdk-52 iOS image already ships a compatible pnpm (see Expo infra docs).
 *
 * @see https://github.com/expo/eas-cli/issues/2978
 */
const fs = require("node:fs");
const path = require("node:path");

const appDir = process.cwd();
const monorepoRoot = path.resolve(appDir, "../..");

function mustExist(relFromRoot, label) {
  const abs = path.join(monorepoRoot, relFromRoot);
  if (!fs.existsSync(abs)) {
    console.error(`[eas-pre-install] Missing ${label}: ${abs}`);
    console.error(
      "[eas-pre-install] Ensure pnpm-workspace.yaml and pnpm-lock.yaml are committed and not excluded by .easignore."
    );
    process.exit(1);
  }
}

mustExist("pnpm-workspace.yaml", "pnpm workspace manifest");
mustExist("pnpm-lock.yaml", "pnpm lockfile");

console.log("[eas-pre-install] OK — monorepo root:", monorepoRoot);
