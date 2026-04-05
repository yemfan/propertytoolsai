import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/siteUrl";

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl().replace(/\/$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
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
        ],
      },
      // Block AI training scrapers
      { userAgent: "GPTBot", disallow: "/" },
      { userAgent: "ChatGPT-User", disallow: "/" },
      { userAgent: "Google-Extended", disallow: "/" },
      { userAgent: "CCBot", disallow: "/" },
      { userAgent: "anthropic-ai", disallow: "/" },
      { userAgent: "Claude-Web", disallow: "/" },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
