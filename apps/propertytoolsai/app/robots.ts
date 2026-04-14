import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/siteUrl";

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
