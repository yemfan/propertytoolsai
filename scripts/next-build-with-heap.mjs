#!/usr/bin/env node
/**
 * Runs `next build` with a guaranteed NODE_OPTIONS heap (Vercel + Turbo + npm workspaces).
 * Resolves the app root from npm_package_name + repo root — Turbo/Vercel cwd is not always apps/<name>.
 */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const scriptFile = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptFile);
const repoRoot = path.resolve(scriptDir, "..");

function resolveAppRoot() {
  const name = process.env.npm_package_name;
  if (name) {
    const candidate = path.join(repoRoot, "apps", name);
    if (existsSync(path.join(candidate, "package.json"))) {
      return candidate;
    }
  }
  const cwd = process.cwd();
  if (existsSync(path.join(cwd, "package.json"))) {
    return cwd;
  }
  return cwd;
}

const appRoot = resolveAppRoot();
const require = createRequire(path.join(appRoot, "package.json"));
const nextPkg = require.resolve("next/package.json");
const nextBin = path.join(path.dirname(nextPkg), "dist", "bin", "next");

const heapMb = process.env.NEXT_BUILD_HEAP_MB ?? "12288";
process.env.NODE_OPTIONS = [process.env.NODE_OPTIONS, `--max-old-space-size=${heapMb}`]
  .filter(Boolean)
  .join(" ");

console.log(
  `[next-build-with-heap] appRoot=${appRoot} npm_package_name=${process.env.npm_package_name ?? "(unset)"} cwd=${process.cwd()} node=${process.version} NODE_OPTIONS=${process.env.NODE_OPTIONS}`
);

const extra = process.argv.slice(2);
const r = spawnSync(process.execPath, [nextBin, "build", ...extra], {
  stdio: "inherit",
  cwd: appRoot,
  env: process.env,
});

process.exit(r.status ?? 1);
