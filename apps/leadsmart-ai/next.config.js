import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Monorepo root (Propertytoolsai/) — fixes Next/Vercel inferring the wrong workspace root */
const monorepoRoot = path.join(__dirname, "../..");

/** Absolute distDir avoids ambiguous output paths on Vercel + workspaces (routes-manifest.json). */
const distDir =
  process.env.NEXT_DIST_IN_MONOREPO_ROOT === "1"
    ? path.join(monorepoRoot, ".next")
    : path.join(__dirname, ".next");

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir,
  // Trace serverless bundles from repo root (required for npm workspaces on Vercel)
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    root: monorepoRoot,
  },
  experimental: {
    // ~1500+ prerendered routes — lower peak RSS on Vercel CI
    staticGenerationMaxConcurrency: 1,
    staticGenerationMinPagesPerWorker: 1,
    webpackMemoryOptimizations: true,
  },
};

export default nextConfig;
