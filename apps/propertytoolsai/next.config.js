import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Monorepo root (Propertytoolsai/) — fixes Next/Vercel inferring the wrong workspace root */
const monorepoRoot = path.join(__dirname, "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/ui", "@leadsmart/shared", "@leadsmart/api-client"],
  /** Nested URL aliases — prefer real route files under `app/api/...` when present. */
  async rewrites() {
    return { beforeFiles: [] };
  },
  /** Nav-friendly URLs → existing tool routes */
  async redirects() {
    return [
      { source: "/cma-report", destination: "/smart-cma-builder", permanent: false },
      {
        source: "/market-value-trends",
        destination: "/market-report/los-angeles-ca",
        permanent: false,
      },
      { source: "/rent-estimator", destination: "/rental-property-analyzer", permanent: false },
      { source: "/roi-cash-flow", destination: "/cash-flow-calculator", permanent: false },
      { source: "/rent-vs-buy", destination: "/rent-vs-buy-calculator", permanent: false },
      {
        source: "/ai-recommended-properties",
        destination: "/serp-hub",
        permanent: false,
      },
      { source: "/smart-next-steps", destination: "/guides", permanent: false },
    ];
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
