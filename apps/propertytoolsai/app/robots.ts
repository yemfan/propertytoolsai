import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/siteUrl";

/**
 * robots.txt — validation report SEO-04 review.
 *
 * AI-crawler posture (one knob; flip the flag below after a brand call):
 *
 *   • Google-Extended      — controls whether Google uses content to train
 *                            Gemini. Does NOT affect indexing or Search
 *                            ranking. Blocking is defensible IP protection
 *                            and is the current posture.
 *
 *   • CCBot (Common Crawl) — blocking removes the site from Common Crawl.
 *                            Many AI answer engines and SEO research tools
 *                            (Ahrefs, SimilarWeb-adjacent) rely on that
 *                            corpus for discovery. The validation report
 *                            flagged: "blocking CCBot hurts the long tail
 *                            [of ambient AI visibility]."
 *
 *                            If the brand wants to be cited in ChatGPT /
 *                            Perplexity / Claude answers, flip
 *                            ALLOW_COMMON_CRAWL to true. It will be treated
 *                            like the other AI search crawlers — allowed on
 *                            public pages, blocked on auth/admin/api.
 *
 *   • GPTBot / ChatGPT-User / Claude-Web — allowed on public pages today.
 *                            This is the "public content only" posture the
 *                            report recommends.
 *
 * This is a branding + strategy decision, not a pure engineering one.
 * Change log the decision when you flip the flag.
 */
const ALLOW_COMMON_CRAWL = false;

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl().replace(/\/$/, "");

  const restrictedPaths = [
    // Auth & account management
    "/auth/",
    "/account/",
    "/access/",
    // Internal dashboards & admin
    "/admin/",
    "/rbac/",
    "/agent/",
    "/broker/",
    "/portal/",
    // API endpoints
    "/api/",
    // Private tool flows
    "/dashboard/",
    "/billing/",
    "/upgrade-to-agent",
    "/agent-signup",
    "/check-plan",
    "/start-trial",
    // Dynamic / session-sensitive
    "/create-checkout-session",
    "/create-property-report",
    "/generate-presentation",
    "/db-test",
  ];

  const aiSearchCrawlers = ["GPTBot", "ChatGPT-User", "Claude-Web"];
  if (ALLOW_COMMON_CRAWL) aiSearchCrawlers.push("CCBot");

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: restrictedPaths,
      },
      // AI search crawlers — public pages only. Auth/admin/api paths are
      // blocked via the shared restrictedPaths list above.
      {
        userAgent: aiSearchCrawlers,
        allow: "/",
        disallow: restrictedPaths,
      },
      // Training-only crawlers. See the header comment for the CCBot
      // trade-off.
      { userAgent: "Google-Extended", disallow: "/" },
      ...(ALLOW_COMMON_CRAWL ? [] : [{ userAgent: "CCBot", disallow: "/" }]),
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
