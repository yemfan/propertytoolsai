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
          // Internal dashboards & admin
          "/admin/",
          "/rbac/",
          "/agent/",
          "/broker/",
          "/portal/",
          "/dashboard/",
          "/dashboard-router",
          // API endpoints
          "/api/",
          // Private flows
          "/billing/",
          "/upgrade-to-agent",
          "/agent-signup",
          "/agent-home-value-leads",
          "/loan-broker",
          "/unauthorized",
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
