import type { MetadataRoute } from "next";
import { getKeywordPagesForCity, TRAFFIC_CITIES } from "@/lib/trafficSeo";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const now = new Date();

  const staticRoutes = [
    "/",
    "/home-value",
    "/landing/home-value",
    "/landing/mortgage-calculator",
    "/content/video-scripts",
    // Public marketing surfaces — high SEO priority alongside the
    // home page since they're the primary conversion targets from
    // organic search.
    "/about",
    "/agent/pricing",
    "/agent/coaching",
    "/agent/compare",
  ];

  // Calculator hub — every public calculator page is indexable
  // and was previously orphaned from the sitemap, leaving Google
  // to discover them via crawl alone.
  const calculatorRoutes = [
    "/mortgage-calculator",
    "/affordability-calculator",
    "/cap-rate-calculator",
    "/cap-rate-roi-calculator",
    "/cash-flow-calculator",
    "/down-payment-calculator",
    "/refinance-calculator",
    "/rent-vs-buy-calculator",
    "/roi-calculator",
    "/adjustable-rate-calculator",
    "/cap-rate-calculator-how-to-use-it",
    "/how-to-calculate-cap-rate",
  ];

  const seoRoutes = TRAFFIC_CITIES.flatMap((c) => [
    `/home-value/${c.slug}`,
    `/sell-house/${c.slug}`,
    `/market-report/${c.slug}`,
  ]);
  const keywordRoutes = TRAFFIC_CITIES.flatMap((c) => [
    ...getKeywordPagesForCity("home-value", c.slug).map((k) => `/home-value/${c.slug}/${k.keywordSlug}`),
    ...getKeywordPagesForCity("sell-house", c.slug).map((k) => `/sell-house/${c.slug}/${k.keywordSlug}`),
    ...getKeywordPagesForCity("market-report", c.slug).map((k) => `/market-report/${c.slug}/${k.keywordSlug}`),
  ]);

  const HIGH_PRIORITY = new Set([
    "/",
    "/about",
    "/agent/pricing",
    "/agent/coaching",
    "/agent/compare",
  ]);

  return [
    ...staticRoutes,
    ...calculatorRoutes,
    ...seoRoutes,
    ...keywordRoutes,
  ].map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: path === "/" ? 1 : HIGH_PRIORITY.has(path) ? 0.9 : 0.7,
  }));
}

