import type { MetadataRoute } from "next";
import { listSeoPagesForSitemap } from "./db";
import { DEFAULT_SEO_SEED_INPUTS } from "./seeds";
import { buildSeoSlug } from "./slug";

/**
 * Sitemap URLs for DB-published programmatic SEO pages.
 * If the table is empty, falls back to default seed slugs so crawlers still see starter URLs.
 */
export async function getSeoSitemapEntries(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://www.propertytoolsai.com"
  ).replace(/\/$/, "");
  const now = new Date();

  const rows = await listSeoPagesForSitemap(5000);

  if (rows.length > 0) {
    return rows.map((row: { slug: string; updated_at?: string | null }) => ({
      url: `${baseUrl}/${row.slug}`,
      lastModified: row.updated_at ? new Date(row.updated_at) : now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    }));
  }

  return DEFAULT_SEO_SEED_INPUTS.map((input) => {
    const slug = buildSeoSlug(input);
    return {
      url: `${baseUrl}/${slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    };
  });
}
