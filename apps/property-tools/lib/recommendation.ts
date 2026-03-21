import type { UserProfile } from "@/lib/userProfile";

export type RecommendedAction = {
  id: string;
  title: string;
  href: string;
  priority: number;
  reason: string;
};

const ACTIONS: Omit<RecommendedAction, "priority" | "reason">[] = [
  { id: "compare", title: "AI Property Comparison", href: "/ai-property-comparison" },
  { id: "cma", title: "Smart CMA Builder", href: "/smart-cma-builder" },
  { id: "mortgage", title: "Mortgage Calculator", href: "/mortgage-calculator" },
  { id: "home_value", title: "Home Value Estimator", href: "/home-value" },
  { id: "cap_rate", title: "Cap Rate Calculator", href: "/cap-rate-calculator" },
  { id: "rent_vs_buy", title: "Rent vs Buy", href: "/rent-vs-buy-calculator" },
  { id: "deal", title: "AI Deal Analyzer", href: "/ai-real-estate-deal-analyzer" },
  { id: "expert", title: "Talk pricing with an expert", href: "/contact" },
];

/**
 * Rules-based next-best-actions from inferred profile.
 */
export function getNextBestActions(profile: UserProfile): RecommendedAction[] {
  const { intent, urgency, signals } = profile;
  const out: RecommendedAction[] = [];

  const push = (partial: RecommendedAction) => {
    if (out.some((x) => x.id === partial.id)) return;
    out.push(partial);
  };

  const base = (id: string, title: string, href: string, priority: number, reason: string) =>
    push({ id, title, href, priority, reason });

  if (intent === "investor") {
    base(
      "compare",
      "AI Property Comparison",
      "/ai-property-comparison",
      95,
      "You’ve explored comparisons — stack deals side-by-side with scores."
    );
    base(
      "cap_rate",
      "Cap Rate Calculator",
      "/cap-rate-calculator",
      88,
      "Investors often pair comparisons with cap-rate checks."
    );
    base("deal", "AI Deal Analyzer", "/ai-real-estate-deal-analyzer", 80, "Stress-test assumptions on a specific listing.");
  } else if (intent === "seller") {
    base(
      "cma",
      "Smart CMA Builder",
      "/smart-cma-builder",
      95,
      "Seller-focused: build a CMA-backed value story for your property."
    );
    base(
      "home_value",
      "Home Value Estimator",
      "/home-value",
      85,
      "Quick value range before you list or negotiate."
    );
    base(
      "compare",
      "AI Property Comparison",
      "/ai-property-comparison",
      72,
      "Compare your home to alternatives buyers may consider."
    );
  } else if (intent === "buyer") {
    base(
      "mortgage",
      "Mortgage Calculator",
      "/mortgage-calculator",
      92,
      "Buyers typically lock in payment math early."
    );
    base(
      "afford",
      "Affordability Calculator",
      "/affordability-calculator",
      86,
      "See what price band fits your income and debts."
    );
    base(
      "rent_vs_buy",
      "Rent vs Buy",
      "/rent-vs-buy-calculator",
      78,
      "Clarify buy vs. rent for your timeline."
    );
  } else {
    base(
      "home_value",
      "Home Value Estimator",
      "/home-value",
      70,
      "Start with a quick value snapshot."
    );
    base(
      "mortgage",
      "Mortgage Calculator",
      "/mortgage-calculator",
      68,
      "Explore monthly payments on sample prices."
    );
    base(
      "cma",
      "Smart CMA Builder",
      "/smart-cma-builder",
      60,
      "See how pros price with comps."
    );
  }

  if (urgency === "high" || (signals.agent_clicked ?? 0) > 0) {
    base("expert", "Contact / expert help", "/contact", 90, "High engagement — talk to a human for your next step.");
  }

  if ((signals.comparison_started ?? 0) > 0 && !out.some((x) => x.id === "compare")) {
    base(
      "compare",
      "AI Property Comparison",
      "/ai-property-comparison",
      75,
      "Continue the comparison workflow you started."
    );
  }

  out.sort((a, b) => b.priority - a.priority);

  if (out.length === 0) {
    return ACTIONS.slice(0, 4).map((a, i) => ({
      ...a,
      priority: 50 - i,
      reason: "Popular next step for PropertyTools users.",
    }));
  }

  return out.slice(0, 6);
}
