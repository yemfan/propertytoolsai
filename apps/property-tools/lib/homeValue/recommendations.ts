import type { ToolkitRecommendation, UserIntent } from "./types";

const BASE = "";

export function getToolkitRecommendations(intent: UserIntent): ToolkitRecommendation[] {
  if (intent === "seller") {
    return [
      {
        title: "Smart CMA Builder",
        href: `${BASE}/smart-cma-builder`,
        reason: "Pair your estimate with a formal CMA for listing conversations.",
        intent: "seller",
      },
      {
        title: "Expert match",
        href: `${BASE}/pricing`,
        reason: "Upgrade for agent tools and lead routing through LeadSmart AI.",
        intent: "seller",
      },
    ];
  }
  if (intent === "buyer") {
    return [
      {
        title: "Mortgage Calculator",
        href: `${BASE}/mortgage-calculator`,
        reason: "Stress-test monthly payment against this value band.",
        intent: "buyer",
      },
      {
        title: "AI Property Comparison",
        href: `${BASE}/ai-property-comparison`,
        reason: "Compare this home to alternatives side-by-side.",
        intent: "buyer",
      },
    ];
  }
  return [
    {
      title: "Rental Property Analyzer",
      href: `${BASE}/rental-property-analyzer`,
      reason: "Layer rent + expenses on top of value for cash-flow view.",
      intent: "investor",
    },
    {
      title: "Cap Rate & ROI Calculator",
      href: `${BASE}/cap-rate-calculator`,
      reason: "Stress-test returns using your value band as a basis.",
      intent: "investor",
    },
  ];
}
