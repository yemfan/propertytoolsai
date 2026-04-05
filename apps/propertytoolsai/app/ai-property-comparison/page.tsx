import { Suspense } from "react";
import PropertyComparisonClient from "@/components/property-comparison/PropertyComparisonClient";
import JsonLd from "@/components/JsonLd";

export const metadata = {
  title: "AI Property Comparison | PropertyTools AI",
  description:
    "Compare multiple investment properties side-by-side with scores and AI-powered recommendations.",
};

export default function AiPropertyComparisonPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "AI Property Comparison Tool",
          applicationCategory: "FinanceApplication",
          operatingSystem: "Web",
          browserRequirements: "Requires JavaScript",
          url: "https://propertytoolsai.com/ai-property-comparison",
          description:
            "Compare investment properties side-by-side with AI scoring on price, location, and investment potential — free.",
          featureList: "Side-by-side property comparison, AI investment scoring, Price per sqft analysis, Monthly cost breakdown",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          provider: { "@type": "Organization", name: "PropertyTools AI", url: "https://propertytoolsai.com" },
        }}
      />
      <Suspense
        fallback={
          <div className="w-full max-w-6xl py-10">
            <div className="rounded-lg border border-gray-200 bg-white p-10 text-center text-gray-600 shadow-md">
              Loading comparison…
            </div>
          </div>
        }
      >
        <PropertyComparisonClient />
      </Suspense>
    </>
  );
}
