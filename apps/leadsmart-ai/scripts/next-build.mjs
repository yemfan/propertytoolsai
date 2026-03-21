#!/usr/bin/env node
/**
 * Launcher: resolves repo `scripts/next-build-with-heap.mjs` from this file's path.
 * Do not use `node ../../scripts/...` in package.json — Turbo/Vercel cwd may be repo root.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(scriptDir, "..", "..", "..");
const heap = path.join(repoRoot, "scripts", "next-build-with-heap.mjs");
const pkg = JSON.parse(readFileSync(path.join(appRoot, "package.json"), "utf8"));

const r = spawnSync(process.execPath, [heap, ...process.argv.slice(2)], {
  stdio: "inherit",
  cwd: appRoot,
  env: {
    ...process.env,
    npm_package_name: pkg.name,
  },
});
process.exit(r.status ?? 1);
