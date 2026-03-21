import type { ClusterTopicDefinition } from "./types";

/**
 * Default cluster topics — combine with `PROGRAMMATIC_SEO_LOCATIONS` (~60) for 1,200+ URLs.
 * Upserted into `seo_cluster_topics` on generate / seed.
 */
export const CLUSTER_TOPICS: ClusterTopicDefinition[] = [
  {
    slug: "first-time-home-buyer-guide",
    name: "First-Time Home Buyer Guide",
    keywords: ["first time home buyer", "buying your first home", "starter home"],
    relatedSlugs: ["down-payment-basics", "mortgage-preapproval-guide", "closing-costs-explained", "home-inspection-guide"],
  },
  {
    slug: "down-payment-basics",
    name: "Down Payment Basics",
    keywords: ["down payment", "how much down payment", "20 percent down"],
    relatedSlugs: ["first-time-home-buyer-guide", "mortgage-preapproval-guide", "affordability-planning"],
  },
  {
    slug: "mortgage-preapproval-guide",
    name: "Mortgage Pre-Approval Guide",
    keywords: ["mortgage pre-approval", "get preapproved", "lender preapproval"],
    relatedSlugs: ["mortgage-rates-explained", "refinance-guide", "first-time-home-buyer-guide"],
  },
  {
    slug: "mortgage-rates-explained",
    name: "Mortgage Rates Explained",
    keywords: ["mortgage rates", "interest rates", "APR vs rate"],
    relatedSlugs: ["refinance-guide", "mortgage-preapproval-guide", "market-timing-real-estate"],
  },
  {
    slug: "refinance-guide",
    name: "Refinance Guide",
    keywords: ["refinance mortgage", "when to refinance", "cash out refinance"],
    relatedSlugs: ["mortgage-rates-explained", "home-equity-guide", "mortgage-preapproval-guide"],
  },
  {
    slug: "home-equity-guide",
    name: "Home Equity Guide",
    keywords: ["home equity", "HELOC", "home equity loan"],
    relatedSlugs: ["refinance-guide", "property-tax-basics", "rental-property-investing"],
  },
  {
    slug: "rental-property-investing",
    name: "Rental Property Investing",
    keywords: ["rental property", "investment property", "landlord basics"],
    relatedSlugs: ["cap-rate-explained", "cash-flow-rentals", "short-term-rental-guide"],
  },
  {
    slug: "cap-rate-explained",
    name: "Cap Rate Explained",
    keywords: ["cap rate", "capitalization rate", "rental yield"],
    relatedSlugs: ["rental-property-investing", "cash-flow-rentals", "multi-family-investing"],
  },
  {
    slug: "cash-flow-rentals",
    name: "Cash Flow for Rentals",
    keywords: ["rental cash flow", "positive cash flow", "rental income"],
    relatedSlugs: ["cap-rate-explained", "rental-property-investing", "property-management-basics"],
  },
  {
    slug: "short-term-rental-guide",
    name: "Short-Term Rental Guide",
    keywords: ["Airbnb investing", "short term rental", "STR regulations"],
    relatedSlugs: ["rental-property-investing", "market-timing-real-estate", "property-management-basics"],
  },
  {
    slug: "multi-family-investing",
    name: "Multi-Family Investing",
    keywords: ["duplex", "multifamily", "house hacking"],
    relatedSlugs: ["rental-property-investing", "cap-rate-explained", "commercial-real-estate-basics"],
  },
  {
    slug: "commercial-real-estate-basics",
    name: "Commercial Real Estate Basics",
    keywords: ["commercial real estate", "CRE investing", "NNN lease"],
    relatedSlugs: ["multi-family-investing", "cap-rate-explained", "market-timing-real-estate"],
  },
  {
    slug: "property-tax-basics",
    name: "Property Tax Basics",
    keywords: ["property tax", "tax assessment", "homestead exemption"],
    relatedSlugs: ["first-time-home-buyer-guide", "home-equity-guide", "escrow-process-explained"],
  },
  {
    slug: "closing-costs-explained",
    name: "Closing Costs Explained",
    keywords: ["closing costs", "title fees", "who pays closing costs"],
    relatedSlugs: ["escrow-process-explained", "first-time-home-buyer-guide", "down-payment-basics"],
  },
  {
    slug: "escrow-process-explained",
    name: "Escrow Process Explained",
    keywords: ["escrow", "closing timeline", "earnest money"],
    relatedSlugs: ["closing-costs-explained", "home-inspection-guide", "first-time-home-buyer-guide"],
  },
  {
    slug: "home-inspection-guide",
    name: "Home Inspection Guide",
    keywords: ["home inspection", "inspection contingency", "repair requests"],
    relatedSlugs: ["first-time-home-buyer-guide", "closing-costs-explained", "negotiation-tips-real-estate"],
  },
  {
    slug: "negotiation-tips-real-estate",
    name: "Real Estate Negotiation Tips",
    keywords: ["offer negotiation", "seller concessions", "competing offers"],
    relatedSlugs: ["home-inspection-guide", "market-timing-real-estate", "first-time-home-buyer-guide"],
  },
  {
    slug: "market-timing-real-estate",
    name: "Market Timing & Real Estate Cycles",
    keywords: ["housing market", "buyers market", "sellers market"],
    relatedSlugs: ["mortgage-rates-explained", "first-time-home-buyer-guide", "rental-property-investing"],
  },
  {
    slug: "affordability-planning",
    name: "Home Affordability Planning",
    keywords: ["how much house can I afford", "DTI", "affordability"],
    relatedSlugs: ["mortgage-preapproval-guide", "down-payment-basics", "first-time-home-buyer-guide"],
  },
  {
    slug: "property-management-basics",
    name: "Property Management Basics",
    keywords: ["property manager", "tenant screening", "lease agreement"],
    relatedSlugs: ["rental-property-investing", "cash-flow-rentals", "short-term-rental-guide"],
  },
  {
    slug: "building-wealth-real-estate",
    name: "Building Wealth with Real Estate",
    keywords: ["real estate wealth", "long term investing", "portfolio"],
    relatedSlugs: ["rental-property-investing", "multi-family-investing", "market-timing-real-estate"],
  },
];

export function getClusterTopicBySlug(slug: string): ClusterTopicDefinition | undefined {
  return CLUSTER_TOPICS.find((t) => t.slug === slug);
}

export function getAllClusterTopicSlugs(): string[] {
  return CLUSTER_TOPICS.map((t) => t.slug);
}
