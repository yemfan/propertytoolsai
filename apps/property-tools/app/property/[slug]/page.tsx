import { notFound } from "next/navigation";
import { getPropertySeoRecordBySlug } from "@/lib/property-seo/service";
import { buildPropertyJsonLd } from "@/lib/property-seo/schema";
import { PropertySeoPage } from "@/components/property/PropertySeoPage";

function siteBaseUrl() {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;
  return "https://www.propertytoolsai.com";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const record = await getPropertySeoRecordBySlug(slug);

  if (!record) {
    return {
      title: "Property not found | PropertyToolsAI",
    };
  }

  return {
    title: `${record.fullAddress} | PropertyToolsAI`,
    description: record.description,
  };
}

export default async function PropertyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const record = await getPropertySeoRecordBySlug(slug);
  if (!record) notFound();

  const jsonLd = buildPropertyJsonLd(record, siteBaseUrl());

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PropertySeoPage record={record} />
    </>
  );
}
