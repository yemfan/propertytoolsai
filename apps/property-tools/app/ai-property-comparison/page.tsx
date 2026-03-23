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
          "@type": "WebApplication",
          name: "AI Property Comparison",
          applicationCategory: "FinanceApplication",
          operatingSystem: "All",
          browserRequirements: "Requires JavaScript",
          url: "https://propertytoolsai.com/ai-property-comparison",
          description:
            "Compare investment properties side-by-side with scoring and AI-powered recommendations.",
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
