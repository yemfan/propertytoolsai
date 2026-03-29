import type { ClusterPagePayload, ClusterTopicDefinition } from "./types";

type Loc = { city: string; state: string; slug: string };

export function buildFallbackClusterPayload(
  topic: ClusterTopicDefinition,
  loc: Loc,
  primaryKeyword: string
): ClusterPagePayload {
  const place = `${loc.city}, ${loc.state}`;
  return {
    insights: [
      `${topic.name} in ${place} starts with understanding local prices, inventory, and how lenders view your profile.`,
      `Use calculators and compare neighborhoods before you commit—${primaryKeyword} searches often spike when rates move.`,
      `Work with a local agent or lender for ${place}-specific rules, disclosures, and timing.`,
    ],
    sections: [
      {
        heading: `Why ${topic.name.toLowerCase()} matters in ${place}`,
        paragraphs: [
          `The ${place} market has its own rhythm: seasonality, employer growth, and migration patterns all affect demand. This guide frames ${topic.name.toLowerCase()} with ${loc.city} in mind.`,
          `Whether you are buying, refinancing, or investing, align your plan with realistic monthly payments, reserves, and exit options.`,
        ],
      },
      {
        heading: "What to do first",
        paragraphs: [
          `Clarify your goal (primary home, rental, or refinance), then gather documents and check credit. For "${primaryKeyword}", prioritize accurate numbers over optimism.`,
          `Interview professionals who know ${loc.city}—small details in contracts and inspections save money later.`,
        ],
      },
      {
        heading: "Pitfalls to avoid",
        paragraphs: [
          `Skipping pre-approval, ignoring closing costs, or waiving inspection without a strategy are common mistakes. Slow down and verify assumptions for your situation.`,
        ],
      },
      {
        heading: "Local context",
        paragraphs: [
          `Regulations, taxes, and insurance vary by county and carrier in ${loc.state}. Use official sources and your team to confirm what applies to you in ${loc.city}.`,
        ],
      },
      {
        heading: "Next steps",
        paragraphs: [
          `Explore related guides linked on this page, run the free calculators on PropertyTools AI, and track rates weekly if you are actively shopping.`,
        ],
      },
    ],
    faqs: [
      {
        question: `How is ${topic.name.toLowerCase()} different in ${place}?`,
        answer: `Local inventory, pricing, and lending overlays can differ from national headlines. Use ${loc.city}-specific comps and talk to a lender licensed in ${loc.state}.`,
      },
      {
        question: `What should I prioritize for "${primaryKeyword}"?`,
        answer: `Clarify budget, timeline, and risk tolerance. Get pre-approved if financing, and keep reserves for repairs and vacancies if investing.`,
      },
      {
        question: "Are online calculators enough?",
        answer: "They are a strong starting point for scenarios, but final numbers depend on underwriting, taxes, insurance, and HOA—verify with professionals.",
      },
      {
        question: `Do I need an agent in ${loc.city}?`,
        answer: "Not legally required, but a knowledgeable agent helps with offers, disclosures, and negotiation—especially in competitive pockets.",
      },
      {
        question: "How often should I revisit my plan?",
        answer: "Re-check when rates move, your income changes, or you are within 90 days of making an offer.",
      },
      {
        question: "Where can I run numbers for free?",
        answer: "Use PropertyTools AI calculators from the main navigation—mortgage, affordability, cap rate, and more.",
      },
    ],
    source: "fallback",
  };
}

export function buildFallbackMetadata(topic: ClusterTopicDefinition, loc: Loc, primaryKeyword: string) {
  const place = `${loc.city}, ${loc.state}`;
  const title = `${topic.name} in ${place} | PropertyTools AI`;
  const description = `${primaryKeyword} — practical, local guidance for ${place}. Free tools and clear next steps for buyers and investors.`;
  return { title, description };
}
