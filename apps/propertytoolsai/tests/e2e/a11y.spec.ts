import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";

/**
 * Automated accessibility regression gate using axe-core.
 *
 * The April 17 validation report explicitly flagged accessibility as deferred
 * but "strongly recommended before any paid-acquisition push, given real
 * estate's 50+ demographic". This suite runs axe against the highest-traffic
 * pages and fails on any `serious` or `critical` violation — the two
 * categories that map to WCAG 2.1 AA failures.
 *
 * Philosophy:
 *   - Block on serious/critical only. moderate + minor violations are reported
 *     to the HTML artifact but don't fail the job, so devs can see what's
 *     remaining without being blocked by color-contrast-on-a-decorative-div.
 *   - Explicit allowlist of pages — we'd rather add deliberately than run
 *     axe on every route and spend the CI budget on low-traffic pages.
 *   - Disable rules that don't apply to an SPA context (e.g. `region` for
 *     floating widgets) only when we've accepted the trade-off.
 */

type A11yTarget = {
  name: string;
  path: string;
  /** Extra page setup before the scan runs. */
  prepare?: (page: Page) => Promise<void>;
};

const TARGETS: readonly A11yTarget[] = [
  { name: "Homepage", path: "/" },
  { name: "Home Value estimator", path: "/home-value" },
  { name: "Pricing", path: "/pricing" },
  { name: "Methodology (new trust page)", path: "/methodology" },
  { name: "Mortgage calculator (sample of template)", path: "/mortgage-calculator" },
  { name: "About", path: "/about" },
];

async function scan(page: Page) {
  return new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    // Decorative gradient divs in hero sections occasionally fail the
    // `landmark-one-main` / `region` rules because they sit outside <main>.
    // Re-enable once those are cleaned up.
    .disableRules(["region"])
    .analyze();
}

for (const target of TARGETS) {
  test(`a11y: ${target.name} has no serious/critical violations`, async ({ page }) => {
    await page.goto(target.path);
    await target.prepare?.(page);

    const results = await scan(page);

    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    const advisory = results.violations.filter(
      (v) => v.impact === "moderate" || v.impact === "minor",
    );

    if (advisory.length > 0) {
      console.log(
        `[a11y advisory] ${target.path} — ${advisory.length} non-blocking issue(s):\n` +
          advisory.map((v) => `  · ${v.id} (${v.impact}): ${v.help}`).join("\n"),
      );
    }

    expect(
      blocking,
      blocking.length
        ? `\nBlocking a11y violations on ${target.path}:\n` +
            blocking
              .map(
                (v) =>
                  `  · ${v.id} (${v.impact}): ${v.help}\n    Affects ${v.nodes.length} node(s)\n    Help URL: ${v.helpUrl}`,
              )
              .join("\n")
        : "",
    ).toEqual([]);
  });
}
