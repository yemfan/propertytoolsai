import type { MetadataRoute } from "next";
import { getClusterGuidePathsForSitemap } from "@/lib/clusterGenerator/db";
import { listSerpHubPathsForSitemap } from "@/lib/serpDominator/db";
import { getProgrammaticSeoUrlPaths } from "@/lib/programmaticSeo";
import { getSeoSitemapEntries } from "@/lib/seo-generator/sitemap";
import { getKeywordPagesForCity, TRAFFIC_CITIES } from "@/lib/trafficSeo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001").replace(/\/$/, "");
  const now = new Date();

  const programmaticToolLocationRoutes = getProgrammaticSeoUrlPaths();

  let clusterGuideRoutes: string[] = [];
  let serpHubRoutes: string[] = [];
  if (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    try {
      clusterGuideRoutes = await getClusterGuidePathsForSitemap();
    } catch {
      clusterGuideRoutes = [];
    }
    try {
      serpHubRoutes = await listSerpHubPathsForSitemap();
    } catch {
      serpHubRoutes = [];
    }
  }

  const staticRoutes = [
    "/",
    "/guides",
    "/home-value",
    "/affordability",
    "/match",
    "/landing/home-value",
    "/landing/mortgage-calculator",
    "/content/video-scripts",
    "/serp-hub",
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

  let programmaticCitySeo: MetadataRoute.Sitemap = [];
  try {
    programmaticCitySeo = await getSeoSitemapEntries();
  } catch {
    programmaticCitySeo = [];
  }

  const pathEntries: MetadataRoute.Sitemap = [
    ...staticRoutes,
    ...seoRoutes,
    ...keywordRoutes,
    ...programmaticToolLocationRoutes,
    ...clusterGuideRoutes,
    ...serpHubRoutes,
  ].map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: path === "/" ? 1 : 0.7,
  }));

  return [...pathEntries, ...programmaticCitySeo];
}

