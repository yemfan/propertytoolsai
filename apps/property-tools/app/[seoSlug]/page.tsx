import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { incrementSeoPageVisit } from "@/lib/seo-generator/db";
import { getGeneratedSeoPageBySlug } from "@/lib/seo-generator/service";
import { SeoLandingPage } from "@/components/seo/SeoLandingPage";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ seoSlug: string }>;
}): Promise<Metadata> {
  const { seoSlug } = await params;
  const page = await getGeneratedSeoPageBySlug(seoSlug);

  if (!page) {
    return { title: "Not found | PropertyToolsAI" };
  }

  return {
    title: page.metaTitle,
    description: page.metaDescription,
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

  return <SeoLandingPage page={page} />;
}
