import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/siteUrl";

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl().replace(/\/$/, "");

  const restrictedPaths = [
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
  ];

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: restrictedPaths,
      },
      // Allow AI search crawlers with same restrictions
      {
        userAgent: ["GPTBot", "ChatGPT-User", "Claude-Web"],
        allow: "/",
        disallow: restrictedPaths,
      },
      // Block training-only crawlers
      { userAgent: "Google-Extended", disallow: "/" },
      { userAgent: "CCBot", disallow: "/" },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
