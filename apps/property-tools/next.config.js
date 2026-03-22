import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Monorepo root (Propertytoolsai/) — fixes Next/Vercel inferring the wrong workspace root */
const monorepoRoot = path.join(__dirname, "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  /** Nested URL aliases to flat handler (avoids HTML 404 in some dev/build setups). */
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/api/home-value/estimate",
          destination: "/api/home-value-estimate",
        },
      ],
    };
  },
  // Relative to this app dir so Next's `path.join(dir, distDir)` resolves correctly on all platforms.
  // An absolute `distDir` breaks on Windows (nested `.../apps/<app>/C:/.../.next`) and can confuse builds.
  ...(process.env.NEXT_DIST_IN_MONOREPO_ROOT === "1" && {
    distDir: "../../.next",
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
