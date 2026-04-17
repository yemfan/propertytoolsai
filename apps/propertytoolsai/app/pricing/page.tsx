import type { Metadata } from "next";
import JsonLd from "@/components/JsonLd";
import PricingClient from "./PricingClient";

/**
 * Server shell for /pricing. The interactive cart/trial/checkout logic is in
 * [PricingClient.tsx](./PricingClient.tsx) — that component is marked
 * `"use client"` and cannot export metadata. This shell supplies:
 *   - Per-page Metadata (title, description, canonical, OG, Twitter) per
 *     validation report SEO-01 coverage audit
 *   - Product + Offer JSON-LD per SEO-02 (rich results unlock for "free plan",
 *     "premium plan" queries; pricing is eligible for Product rich snippets)
 *   - FAQPage JSON-LD (none yet — add when pricing FAQ section lands)
 *   - BreadcrumbList JSON-LD
 */

const SITE_URL = "https://propertytoolsai.com";

export const metadata: Metadata = {
  title: "Pricing — Free vs Premium",
  description:
    "Free forever plan with core tools, or Premium at $19/month for unlimited reports, exports, and priority support. 7-day free trial on Premium.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Pricing — PropertyTools AI",
    description:
      "Free forever plan with core tools, or Premium at $19/month for unlimited access. 7-day free trial.",
    url: `${SITE_URL}/pricing`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing — PropertyTools AI",
    description:
      "Free forever plan with core tools, or Premium at $19/month for unlimited access.",
  },
  keywords: [
    "PropertyTools AI pricing",
    "home value estimator pricing",
    "real estate calculator pricing",
    "CMA report pricing",
  ],
};

export default function PricingPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: "PropertyTools AI — Premium",
          description:
            "Unlimited access to every PropertyTools AI calculator, AI CMA reports, and market analysis. 7-day free trial.",
          brand: { "@type": "Brand", name: "PropertyTools AI" },
          offers: [
            {
              "@type": "Offer",
              name: "Free",
              price: "0",
              priceCurrency: "USD",
              availability: "https://schema.org/InStock",
              url: `${SITE_URL}/pricing`,
              description:
                "Core tools with fair daily limits. No credit card required.",
            },
            {
              "@type": "Offer",
              name: "Premium",
              price: "19",
              priceCurrency: "USD",
              priceSpecification: {
                "@type": "UnitPriceSpecification",
                price: "19",
                priceCurrency: "USD",
                billingDuration: "P1M",
                billingIncrement: 1,
                unitCode: "MON",
              },
              availability: "https://schema.org/InStock",
              url: `${SITE_URL}/pricing`,
              description:
                "Unlimited access. 7-day free trial, cancel anytime.",
            },
          ],
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}` },
            { "@type": "ListItem", position: 2, name: "Pricing", item: `${SITE_URL}/pricing` },
          ],
        }}
      />
      <PricingClient />
    </>
  );
}
