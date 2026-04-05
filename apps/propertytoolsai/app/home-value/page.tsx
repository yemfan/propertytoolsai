import type { Metadata } from "next";
import HomeValueEstimatePage from "@/components/home-value/HomeValueEstimatePage";
import JsonLd from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "Free Home Value Estimate",
  description:
    "Get a free AI-powered home value estimate with confidence range and comparable sales data instantly.",
  keywords: [
    "home value estimate",
    "home valuation",
    "property value",
    "home appraisal",
    "house value",
  ],
  openGraph: {
    title: "Free Home Value Estimate | PropertyTools AI",
    description: "Get a free AI-powered home value estimate with confidence range and comparable sales data instantly.",
    type: "website",
  },
};

export default function HomeValuePage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Free Home Value Estimator",
          applicationCategory: "FinanceApplication",
          operatingSystem: "Web",
          browserRequirements: "Requires JavaScript",
          url: "https://propertytoolsai.com/home-value",
          description:
            "Get a free AI-powered home value estimate with a confidence range and comparable sales — instantly, no agent required.",
          featureList: "Instant home value estimate, Confidence range, Comparable sales data, No sign-up required",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          provider: { "@type": "Organization", name: "PropertyTools AI", url: "https://propertytoolsai.com" },
        }}
      />
      <HomeValueEstimatePage />
    </>
  );
}
