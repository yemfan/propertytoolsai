import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for PropertyToolsAI.
 *
 * Scope per validation report QA-02: the core product is calculators; zero
 * deterministic test coverage today. This suite starts with the five primary
 * calculators (mortgage, affordability, rent-vs-buy, cap-rate, ROI) and
 * establishes the pattern for other tools.
 *
 * Philosophy:
 *   - Hit the running dev server, not a mocked environment. Calculators are
 *     pure math; no DB/API is needed, so dev-server tests are fast and real.
 *   - Test baseline desktop + one mobile viewport (iOS Safari-class) — the
 *     report explicitly flagged 390px mobile as the biggest QA risk.
 *   - Treat the first reactive calculation as the "submit" — these pages
 *     compute on input change, so we type and assert on the live result.
 *
 * Run locally:  `pnpm test:e2e`
 * Run with UI:  `pnpm test:e2e:ui`
 * CI: see .github/workflows/e2e.yml
 */

const PORT = Number(process.env.PORT || 3001);
const BASE_URL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  expect: { timeout: 5_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  // Start `next dev` automatically if not already running.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm dev",
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: "pipe",
        stderr: "pipe",
      },

  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 13"] },
    },
  ],
});
