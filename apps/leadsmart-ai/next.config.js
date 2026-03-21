import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Monorepo root (Propertytoolsai/) — fixes Next/Vercel inferring the wrong workspace root */
const monorepoRoot = path.join(__dirname, "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // When Vercel "Root Directory" is the monorepo root, Vercel expects `.next` at `/vercel/path0/.next`,
  // but `next build` normally writes to `apps/<app>/.next`. Set env in Vercel:
  // NEXT_DIST_IN_MONOREPO_ROOT=1 — only from root `build:vercel-*-root` scripts (see docs/VERCEL.md).
  ...(process.env.NEXT_DIST_IN_MONOREPO_ROOT === "1" && {
    distDir: path.join(monorepoRoot, ".next"),
  }),
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
