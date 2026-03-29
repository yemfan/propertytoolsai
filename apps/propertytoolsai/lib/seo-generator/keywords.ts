import type { SeoGeneratorInput, SeoPageTemplate } from "./types";

export type ExpansionSeedCity = {
  city: string;
  state: string;
  zip?: string;
  priceBuckets?: number[];
  bedCounts?: number[];
  propertyTypes?: Array<"single_family" | "condo" | "townhome" | "multi_family">;
};

export function buildExpansionInputsForCity(seed: ExpansionSeedCity): SeoGeneratorInput[] {
  const templates: SeoPageTemplate[] = [
    "city_price",
    "city_beds",
    "city_affordability",
    "city_investment",
    "city_property_type",
  ];

  const inputs: SeoGeneratorInput[] = [];
  const priceBuckets = seed.priceBuckets ?? [500_000, 650_000, 800_000, 1_000_000, 1_500_000];
  const bedCounts = seed.bedCounts ?? [2, 3, 4];
  const propertyTypes = seed.propertyTypes ?? ["single_family", "condo", "townhome"];

  for (const template of templates) {
    if (template === "city_price") {
      for (const maxPrice of priceBuckets) {
        inputs.push({
          city: seed.city,
          state: seed.state,
          zip: seed.zip,
          maxPrice,
          template,
        });
      }
    } else if (template === "city_beds") {
      for (const beds of bedCounts) {
        inputs.push({
          city: seed.city,
          state: seed.state,
          zip: seed.zip,
          beds,
          template,
        });
      }
    } else if (template === "city_property_type") {
      for (const propertyType of propertyTypes) {
        inputs.push({
          city: seed.city,
          state: seed.state,
          zip: seed.zip,
          propertyType,
          template,
        });
      }
    } else {
      inputs.push({
        city: seed.city,
        state: seed.state,
        zip: seed.zip,
        template,
      });
    }
  }

  return inputs;
}

export function getDefaultExpansionCities(): ExpansionSeedCity[] {
  return [
    { city: "Pasadena", state: "CA" },
    { city: "Alhambra", state: "CA" },
    { city: "Monterey Park", state: "CA" },
    { city: "San Gabriel", state: "CA" },
    { city: "Arcadia", state: "CA" },
    { city: "Rowland Heights", state: "CA" },
    { city: "Rosemead", state: "CA" },
    { city: "El Monte", state: "CA" },
  ];
}
