/** Tool slugs used for programmatic SEO landing pages */
export const GROWTH_SEO_TOOLS = [
  { slug: "mortgage-calculator", name: "Mortgage Calculator", category: "Finance" },
  { slug: "cap-rate-calculator", name: "Cap Rate Calculator", category: "Investing" },
  { slug: "home-value-estimator", name: "Home Value Estimator", category: "Valuation" },
  { slug: "rent-vs-buy-calculator", name: "Rent vs Buy Calculator", category: "Finance" },
  { slug: "closing-cost-estimator", name: "Closing Cost Estimator", category: "Finance" },
] as const;

/** City slugs: kebab case + state (matches existing site patterns) */
export const GROWTH_SEO_CITIES = [
  { slug: "los-angeles-ca", city: "Los Angeles", state: "CA" },
  { slug: "san-diego-ca", city: "San Diego", state: "CA" },
  { slug: "san-francisco-ca", city: "San Francisco", state: "CA" },
  { slug: "phoenix-az", city: "Phoenix", state: "AZ" },
  { slug: "austin-tx", city: "Austin", state: "TX" },
  { slug: "miami-fl", city: "Miami", state: "FL" },
  { slug: "denver-co", city: "Denver", state: "CO" },
  { slug: "seattle-wa", city: "Seattle", state: "WA" },
] as const;

export type GrowthSeoTool = (typeof GROWTH_SEO_TOOLS)[number];
export type GrowthSeoCity = (typeof GROWTH_SEO_CITIES)[number];
