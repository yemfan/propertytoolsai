/**
 * Dynamic sitemap generation for SEO
 * Includes static marketing pages and dynamic organization profiles
 */

import type { MetadataRoute } from "next";
import { createServiceClient } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://helmsmart.app";
  const supabase = await createServiceClient();

  const sitemapUrls: MetadataRoute.Sitemap = [
    // Static marketing pages
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/features`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  // Try to add blog posts if they exist
  try {
    const { data: posts } = await supabase
      .from("blog_posts")
      .select("slug, updated_at")
      .eq("status", "published")
      .limit(100);

    if (posts) {
      posts.forEach((post) => {
        sitemapUrls.push({
          url: `${baseUrl}/blog/${post.slug}`,
          lastModified: post.updated_at ? new Date(post.updated_at) : new Date(),
          changeFrequency: "monthly",
          priority: 0.6,
        });
      });
    }
  } catch {
    // Blog table might not exist, skip silently
  }

  return sitemapUrls;
}
