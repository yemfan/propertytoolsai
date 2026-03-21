#!/usr/bin/env node
/**
 * Runs `next build` with a guaranteed NODE_OPTIONS heap (Vercel + Turbo + npm workspaces).
 * cross-env in nested workspace scripts can fail to propagate; this always sets the env
 * before spawning Next.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { createRequire } from "node:module";

const appRoot = process.cwd();
const require = createRequire(path.join(appRoot, "package.json"));
const nextPkg = require.resolve("next/package.json");
const nextBin = path.join(path.dirname(nextPkg), "dist", "bin", "next");

const heapMb = process.env.NEXT_BUILD_HEAP_MB ?? "12288";
process.env.NODE_OPTIONS = [process.env.NODE_OPTIONS, `--max-old-space-size=${heapMb}`]
  .filter(Boolean)
  .join(" ");

// If this line is missing in Vercel logs, the deploy is not running the current `main` (old `cross-env next build` script).
console.log(
  `[next-build-with-heap] cwd=${appRoot} node=${process.version} NODE_OPTIONS=${process.env.NODE_OPTIONS}`
);

const extra = process.argv.slice(2);
const r = spawnSync(process.execPath, [nextBin, "build", ...extra], {
  stdio: "inherit",
  cwd: appRoot,
  env: process.env,
});

process.exit(r.status ?? 1);
