import type { PropertySeoRecord } from "./types";

export function buildPropertyJsonLd(record: PropertySeoRecord, baseUrl: string) {
  const canonical = `${baseUrl.replace(/\/$/, "")}/property/${record.slug}`;

  const residence: Record<string, unknown> = {
    "@type": "SingleFamilyResidence",
    name: record.fullAddress,
    address: {
      "@type": "PostalAddress",
      streetAddress: record.streetAddress,
      addressLocality: record.city,
      addressRegion: record.state,
      postalCode: record.zip,
      addressCountry: "US",
    },
    numberOfRooms: record.beds,
    numberOfBedrooms: record.beds,
    numberOfBathroomsTotal: record.baths,
    image: record.photos.map((p) => p.url),
    url: canonical,
  };

  if (typeof record.sqft === "number") {
    residence.floorSize = {
      "@type": "QuantitativeValue",
      value: record.sqft,
      unitCode: "FTK",
    };
  }

  const webPageDescription =
    record.description?.trim() ||
    `${record.fullAddress} — estimated value and neighborhood context on PropertyToolsAI.`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      residence,
      {
        "@type": "WebPage",
        name: `${record.fullAddress} | PropertyToolsAI`,
        url: canonical,
        description: webPageDescription,
      },
      {
        "@type": "FAQPage",
        mainEntity: record.faq.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      },
    ],
  };
}
