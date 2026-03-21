import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Monorepo root (Propertytoolsai/) — fixes Next/Vercel inferring the wrong workspace root */
const monorepoRoot = path.join(__dirname, "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Same as leadsmart-ai: see NEXT_BUILD_OUTPUT_AT_MONOREPO_ROOT in docs/VERCEL.md
  ...(process.env.NEXT_BUILD_OUTPUT_AT_MONOREPO_ROOT === "1" && {
    distDir: path.join(monorepoRoot, ".next"),
  }),
  // Trace serverless bundles from repo root (required for npm workspaces on Vercel)
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    root: monorepoRoot,
  },
  experimental: {
    // ~2500+ prerendered routes — lower peak RSS on Vercel (avoids OOM during "Generating static pages")
    staticGenerationMaxConcurrency: 1,
    staticGenerationMinPagesPerWorker: 1,
    webpackMemoryOptimizations: true,
  },
};

export default nextConfig;
