/**
 * EAS Build runs this before `pnpm install`. Resolve the monorepo root from this
 * file's location — `process.cwd()` is not always `apps/leadsmart-mobile` on EAS.
 *
 * @see https://github.com/expo/eas-cli/issues/2978
 */
const fs = require("node:fs");
const path = require("node:path");

const scriptDir = __dirname;
const monorepoRoot = path.resolve(scriptDir, "../..");

function mustExist(relFromRoot, label) {
  const abs = path.join(monorepoRoot, relFromRoot);
  if (!fs.existsSync(abs)) {
    console.error(`[eas-pre-install] Missing ${label}: ${abs}`);
    console.error(
      "[eas-pre-install] Ensure pnpm-workspace.yaml and pnpm-lock.yaml are committed (not excluded by .easignore)."
    );
    process.exit(1);
  }
}

mustExist("pnpm-workspace.yaml", "pnpm workspace manifest");
mustExist("pnpm-lock.yaml", "pnpm lockfile");

console.log("[eas-pre-install] OK — monorepo root:", monorepoRoot);
console.log("[eas-pre-install] cwd:", process.cwd());
