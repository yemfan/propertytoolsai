import type { Metadata } from "next";
import HomeValueEstimatePage from "@/components/home-value/HomeValueEstimatePage";
import JsonLd from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "Free Home Value Estimate | PropertyToolsAI",
  description: "Get a free home value estimate with an estimated range and confidence score.",
  openGraph: {
    title: "Free Home Value Estimate | PropertyToolsAI",
    description: "Get a free home value estimate with an estimated range and confidence score.",
    type: "website",
  },
};

export default function HomeValuePage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Free home value estimate",
          applicationCategory: "FinanceApplication",
          operatingSystem: "All",
          browserRequirements: "Requires JavaScript",
          url: "https://propertytoolsai.com/home-value",
          description:
            "Get a free estimated home value range and confidence score. Not an appraisal — for informational use.",
        }}
      />
      <HomeValueEstimatePage />
    </>
  );
}
