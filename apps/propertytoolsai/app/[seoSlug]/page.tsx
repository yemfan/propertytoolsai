import type { Metadata } from "next";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import { incrementSeoPageVisit } from "@/lib/seo-generator/db";
import { getGeneratedSeoPageBySlug } from "@/lib/seo-generator/service";
import { getSiteUrl } from "@/lib/siteUrl";
import { SeoLandingPage } from "@/components/seo/SeoLandingPage";

export const dynamic = "force-dynamic";

const SITE_URL = getSiteUrl().replace(/\/$/, "");

export async function generateMetadata({
  params,
}: {
  params: Promise<{ seoSlug: string }>;
}): Promise<Metadata> {
  const { seoSlug } = await params;
  const page = await getGeneratedSeoPageBySlug(seoSlug);

  if (!page) {
    return { title: "Not found | PropertyToolsAI", robots: { index: false, follow: false } };
  }

  const url = `${SITE_URL}/${seoSlug}`;
  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: { canonical: `/${seoSlug}` },
    openGraph: {
      title: page.metaTitle,
      description: page.metaDescription,
      url,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: page.metaTitle,
      description: page.metaDescription,
    },
  };
}

export default async function GeneratedSeoPage({
  params,
}: {
  params: Promise<{ seoSlug: string }>;
}) {
  const { seoSlug } = await params;
  const page = await getGeneratedSeoPageBySlug(seoSlug);

  if (!page) notFound();

  void incrementSeoPageVisit(seoSlug);

  const url = `${SITE_URL}/${seoSlug}`;
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: page.metaTitle,
          description: page.metaDescription,
          url,
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: page.metaTitle, item: url },
          ],
        }}
      />
      <SeoLandingPage page={page} />
    </>
  );
}
