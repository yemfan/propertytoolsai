import type { ProgrammaticSeoTool } from "./types";

/**
 * Tools with real routes under `apps/propertytoolsai/app/<slug>/page.tsx`.
 * Expand this list to scale programmatic URLs.
 */
export const PROGRAMMATIC_SEO_TOOLS: ProgrammaticSeoTool[] = [
  {
    slug: "cap-rate-calculator",
    name: "Cap Rate Calculator",
    category: "Investing",
    tagline: "Estimate capitalization rate for rental and investment properties.",
    relatedSlugs: ["cash-flow-calculator", "roi-calculator", "rental-property-analyzer", "property-investment-analyzer"],
  },
  {
    slug: "mortgage-calculator",
    name: "Mortgage Calculator",
    category: "Financing",
    tagline: "Monthly payment estimates with taxes and insurance context.",
    relatedSlugs: ["affordability-calculator", "refinance-calculator", "rent-vs-buy-calculator", "down-payment-calculator"],
  },
  {
    slug: "rent-vs-buy-calculator",
    name: "Rent vs Buy Calculator",
    category: "Financing",
    tagline: "Compare renting versus buying with total-cost framing.",
    relatedSlugs: ["mortgage-calculator", "affordability-calculator", "closing-cost-estimator"],
  },
  {
    slug: "cash-flow-calculator",
    name: "Cash Flow Calculator",
    category: "Investing",
    tagline: "Model monthly cash flow for rentals before and after financing.",
    relatedSlugs: ["cap-rate-calculator", "roi-calculator", "rental-property-analyzer"],
  },
  {
    slug: "roi-calculator",
    name: "ROI Calculator",
    category: "Investing",
    tagline: "Return on investment scenarios for flips and rentals.",
    relatedSlugs: ["cap-rate-calculator", "cash-flow-calculator", "property-investment-analyzer"],
  },
  {
    slug: "down-payment-calculator",
    name: "Down Payment Calculator",
    category: "Financing",
    tagline: "See how down payment size changes monthly cost and PMI.",
    relatedSlugs: ["mortgage-calculator", "affordability-calculator", "closing-cost-estimator"],
  },
  {
    slug: "refinance-calculator",
    name: "Refinance Calculator",
    category: "Financing",
    tagline: "Break-even and savings when refinancing your mortgage.",
    relatedSlugs: ["mortgage-calculator", "adjustable-rate-calculator"],
  },
  {
    slug: "closing-cost-estimator",
    name: "Closing Cost Estimator",
    category: "Financing",
    tagline: "Ballpark closing costs for buyers and sellers.",
    relatedSlugs: ["mortgage-calculator", "down-payment-calculator", "rent-vs-buy-calculator"],
  },
  {
    slug: "affordability-calculator",
    name: "Affordability Calculator",
    category: "Financing",
    tagline: "How much house you may afford based on income and debts.",
    relatedSlugs: ["mortgage-calculator", "down-payment-calculator", "rent-vs-buy-calculator"],
  },
  {
    slug: "adjustable-rate-calculator",
    name: "Adjustable-Rate Mortgage Calculator",
    category: "Financing",
    tagline: "ARM payment paths when rates adjust over time.",
    relatedSlugs: ["mortgage-calculator", "refinance-calculator"],
  },
  {
    slug: "home-value",
    name: "Home Value Estimator",
    category: "Valuation",
    tagline: "Estimate home value with local market context.",
    relatedSlugs: ["smart-cma-builder", "ai-cma-analyzer", "hoa-fee-tracker"],
  },
  {
    slug: "rental-property-analyzer",
    name: "Rental Property Analyzer",
    category: "Investing",
    tagline: "Deep dive on rental income, expenses, and long-term performance.",
    relatedSlugs: ["cap-rate-calculator", "cash-flow-calculator", "property-investment-analyzer"],
  },
  {
    slug: "property-investment-analyzer",
    name: "Property Investment Analyzer",
    category: "Investing",
    tagline: "Scenario modeling for buy-and-hold and value-add deals.",
    relatedSlugs: ["rental-property-analyzer", "cap-rate-calculator", "roi-calculator"],
  },
  {
    slug: "hoa-fee-tracker",
    name: "HOA Fee Tracker",
    category: "Ownership",
    tagline: "Track HOA costs and impact on monthly housing spend.",
    relatedSlugs: ["home-value", "mortgage-calculator", "affordability-calculator"],
  },
  {
    slug: "smart-cma-builder",
    name: "Smart CMA Builder",
    category: "Valuation",
    tagline: "Build a comparative market analysis with guided inputs.",
    relatedSlugs: ["home-value", "ai-cma-analyzer", "ai-property-comparison"],
  },
  {
    slug: "ai-real-estate-deal-analyzer",
    name: "AI Real Estate Deal Analyzer",
    category: "AI Tools",
    tagline: "AI-assisted read on deal strength and risk flags.",
    relatedSlugs: ["property-investment-analyzer", "rental-property-analyzer", "ai-cma-analyzer"],
  },
  {
    slug: "ai-cma-analyzer",
    name: "AI CMA Analyzer",
    category: "AI Tools",
    tagline: "Upload or paste comps for AI-driven pricing narrative.",
    relatedSlugs: ["smart-cma-builder", "home-value", "ai-property-comparison"],
  },
  {
    slug: "ai-property-comparison",
    name: "AI Property Comparison",
    category: "AI Tools",
    tagline: "Side-by-side property comparison with AI summary.",
    relatedSlugs: ["ai-cma-analyzer", "smart-cma-builder", "rent-vs-buy-calculator"],
  },
];

const bySlug = new Map(PROGRAMMATIC_SEO_TOOLS.map((t) => [t.slug, t]));

export function getProgrammaticToolBySlug(slug: string): ProgrammaticSeoTool | undefined {
  return bySlug.get(slug);
}

export function getRelatedTools(slug: string, limit = 5): ProgrammaticSeoTool[] {
  const tool = bySlug.get(slug);
  if (!tool) return [];
  const out: ProgrammaticSeoTool[] = [];
  const seen = new Set<string>([slug]);
  for (const r of tool.relatedSlugs) {
    const t = bySlug.get(r);
    if (t && !seen.has(t.slug)) {
      out.push(t);
      seen.add(t.slug);
    }
    if (out.length >= limit) break;
  }
  for (const t of PROGRAMMATIC_SEO_TOOLS) {
    if (out.length >= limit) break;
    if (t.category === tool.category && !seen.has(t.slug)) {
      out.push(t);
      seen.add(t.slug);
    }
  }
  return out.slice(0, limit);
}
