/**
 * robots.txt generation for SEO
 * Controls search engine crawler access to the site
 */

import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://helmsmart.app";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/features", "/pricing", "/blog", "/faq", "/privacy", "/terms", "/contact"],
        disallow: [
          "/api/",
          "/dashboard/",
          "/home/",
          "/admin/",
          "/_next/",
          "/static/",
          "/*.json$",
          "/?*utm_*",
          "/?*sort=",
          "/?*page=",
        ],
      },
      {
        userAgent: "AdsBot-Google",
        allow: "/",
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
