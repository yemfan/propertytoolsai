/**
 * EAS Build (macOS/Linux): pnpm may fail with EACCES mkdir …/apps/<app>/node_modules
 * if workspace dirs were extracted without write bits.
 *
 * Important: the pre-install hook may run with a cwd that is NOT inside the repo
 * (so walking from process.cwd() never finds pnpm-workspace.yaml). This script
 * always resolves the monorepo root from its path under repo/scripts/.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getWorkspaceRoot() {
  const fromScript = path.resolve(__dirname, "..");
  if (fs.existsSync(path.join(fromScript, "pnpm-workspace.yaml"))) {
    return fromScript;
  }
  let dir = path.resolve(process.cwd());
  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return fromScript;
}

function main() {
  if (process.platform === "win32") return;

  const root = getWorkspaceRoot();
  const apps = path.join(root, "apps");
  const packages = path.join(root, "packages");

  console.log(
    `[eas-chmod-workspaces] repoRoot=${root} (pnpm EACCES workaround; cwd=${process.cwd()})`,
  );

  for (const p of [apps, packages]) {
    try {
      if (fs.existsSync(p)) {
        execSync(`chmod -R u+w "${p}"`, { stdio: "ignore" });
      }
    } catch {
      // ignore
    }
  }

  // Ensure the Expo app package can create node_modules (mkdir is what pnpm fails on).
  const mobileNm = path.join(root, "apps", "leadsmart-mobile", "node_modules");
  try {
    fs.mkdirSync(mobileNm, { recursive: true, mode: 0o755 });
  } catch {
    // ignore — pnpm will retry
  }
}

main();
