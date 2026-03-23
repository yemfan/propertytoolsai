import HomeValueTool from "@/components/homeValue/HomeValueTool";
import JsonLd from "@/components/JsonLd";

export default function HomeValuePage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Home value estimate",
          applicationCategory: "FinanceApplication",
          operatingSystem: "All",
          browserRequirements: "Requires JavaScript",
          url: "https://propertytoolsai.com/home-value",
          description:
            "Get an automated home value estimate with a value range and confidence — not an appraisal. Refine property details for a tighter band.",
        }}
      />
      <HomeValueTool />
    </>
  );
}
