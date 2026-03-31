#!/usr/bin/env node
/**
 * Runs `next build` with NODE_OPTIONS heap (Vercel + Turbo + npm workspaces).
 * Self-contained under `apps/<name>/scripts` — does not depend on repo root `scripts/`
 * (Vercel Root Directory builds may not include those files).
 */
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");
const pkg = JSON.parse(readFileSync(path.join(appRoot, "package.json"), "utf8"));

/** Monorepo root `prisma/schema.prisma` — without `prisma generate`, `@prisma/client` has no enums/models (TS fails on Vercel). */
const monorepoRoot = path.resolve(appRoot, "..", "..");
const prismaSchemaPath = path.join(monorepoRoot, "prisma", "schema.prisma");
if (existsSync(prismaSchemaPath)) {
  console.log("[next-build] prisma generate", prismaSchemaPath);
  const gen = spawnSync(
    "pnpm",
    ["exec", "prisma", "generate", `--schema=${prismaSchemaPath}`],
    { cwd: monorepoRoot, stdio: "inherit", shell: true, env: process.env },
  );
  if (gen.status !== 0) {
    console.error("[next-build] prisma generate failed");
    process.exit(gen.status ?? 1);
  }
}

const require = createRequire(path.join(appRoot, "package.json"));
let nextBin;
try {
  const nextPkg = require.resolve("next/package.json");
  nextBin = path.join(path.dirname(nextPkg), "dist", "bin", "next");
} catch (e) {
  console.error("[next-build] Failed to resolve `next` from", appRoot, e);
  process.exit(1);
}

if (!existsSync(nextBin)) {
  console.error("[next-build] next binary missing at", nextBin);
  process.exit(1);
}

const defaultHeapMb = process.env.NEXT_BUILD_HEAP_MB ?? "12288";

/**
 * Vercel often sets NODE_OPTIONS in vercel.json; dashboards sometimes typo
 * `--max_old_space_size` (invalid). Deduplicate and use the largest heap (MB).
 */
function mergeNodeOptionsHeap(base, fallbackMb) {
  let maxMb = parseInt(fallbackMb, 10);
  if (!Number.isFinite(maxMb) || maxMb < 64) maxMb = 12288;
  const s = String(base ?? "").trim();
  for (const re of [/--max-old-space-size=(\d+)/gi, /--max_old_space_size=(\d+)/gi]) {
    for (const m of s.matchAll(re)) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n)) maxMb = Math.max(maxMb, n);
    }
  }
  const cleaned = s
    .replace(/--max-old-space-size=\d+/gi, " ")
    .replace(/--max_old_space_size=\d+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const heap = `--max-old-space-size=${maxMb}`;
  return cleaned ? `${cleaned} ${heap}` : heap;
}

process.env.NODE_OPTIONS = mergeNodeOptionsHeap(process.env.NODE_OPTIONS, defaultHeapMb);

// Next 16 defaults to Turbopack for `next build`. Do NOT force `--webpack` on Vercel by
// default: webpack + @tailwindcss/postcss + native lightningcss/oxide often fails in CI
// (require-hook / "Build failed because of webpack errors"). Opt in with NEXT_BUILD_USE_WEBPACK=1.
const extra = process.argv.slice(2);
const useWebpack = process.env.NEXT_BUILD_USE_WEBPACK === "1";
const buildArgs = [nextBin, "build", ...extra];
if (useWebpack && !buildArgs.includes("--webpack")) {
  buildArgs.push("--webpack");
}

console.log(
  `[next-build] appRoot=${appRoot} name=${pkg.name} cwd=${process.cwd()} node=${process.version} bundler=${useWebpack ? "webpack" : "turbopack"} VERCEL=${process.env.VERCEL ?? ""} NODE_OPTIONS=${process.env.NODE_OPTIONS}`
);

const r = spawnSync(process.execPath, buildArgs, {
  stdio: "inherit",
  cwd: appRoot,
  env: {
    ...process.env,
    npm_package_name: pkg.name,
  },
});

if (r.error) {
  console.error("[next-build] spawn failed:", r.error);
  process.exit(1);
}
if (r.signal) {
  console.error("[next-build] next build killed by signal:", r.signal);
}
if (r.status != null && r.status !== 0) {
  console.error("[next-build] next build exited with code:", r.status);
}
process.exit(r.status ?? 1);
