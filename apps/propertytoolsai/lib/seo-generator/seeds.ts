import type { SeoGeneratorInput, SeoPageTemplate } from "./types";

/** Default starter cities (used for fallback rendering before DB is populated). */
export const DEFAULT_SEO_SEED_INPUTS: SeoGeneratorInput[] = [
  { city: "Pasadena", state: "CA", maxPrice: 800000, template: "city_price" },
  { city: "Alhambra", state: "CA", beds: 3, template: "city_beds" },
  { city: "Monterey Park", state: "CA", template: "city_affordability" },
  { city: "San Gabriel", state: "CA", template: "city_investment" },
];

export type SeoSeedConfig = {
  cities: Array<{ city: string; state: string; zip?: string }>;
  priceBuckets?: number[];
  bedCounts?: number[];
  propertyTypes?: Array<"single_family" | "condo" | "townhome" | "multi_family">;
  templates?: SeoPageTemplate[];
};

export function buildSeoSeedInputs(config: SeoSeedConfig): SeoGeneratorInput[] {
  const priceBuckets = config.priceBuckets ?? [500_000, 800_000, 1_000_000, 1_500_000];
  const bedCounts = config.bedCounts ?? [2, 3, 4];
  const propertyTypes = config.propertyTypes ?? ["single_family", "condo", "townhome"];
  const templates = config.templates ?? [
    "city_price",
    "city_beds",
    "city_affordability",
    "city_investment",
    "city_property_type",
  ];

  const inputs: SeoGeneratorInput[] = [];

  for (const location of config.cities) {
    for (const template of templates) {
      if (template === "city_price") {
        for (const maxPrice of priceBuckets) {
          inputs.push({
            city: location.city,
            state: location.state,
            zip: location.zip,
            maxPrice,
            template,
          });
        }
      } else if (template === "city_beds") {
        for (const beds of bedCounts) {
          inputs.push({
            city: location.city,
            state: location.state,
            zip: location.zip,
            beds,
            template,
          });
        }
      } else if (template === "city_property_type") {
        for (const propertyType of propertyTypes) {
          inputs.push({
            city: location.city,
            state: location.state,
            zip: location.zip,
            propertyType,
            template,
          });
        }
      } else {
        inputs.push({
          city: location.city,
          state: location.state,
          zip: location.zip,
          template,
        });
      }
    }
  }

  return inputs;
}
