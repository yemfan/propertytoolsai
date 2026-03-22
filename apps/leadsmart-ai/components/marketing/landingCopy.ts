export type UserRole = "agent" | "broker";

export type LandingCopy = {
  hero: {
    eyebrow: string;
    headline: string;
    line1: string;
    /** Optional — brokers often use headline + single line only */
    line2?: string;
    line3?: string;
    primaryCta: string;
    secondaryCta: string;
    /** Shown under hero CTAs */
    trustLine: string;
  };
  problem: {
    title: string;
    subtitle: string;
    intro: string;
    painLabel: string;
    pains: string[];
    closingLead: string;
    closingEmphasis: string;
  };
  solution: {
    title: string;
    punch1: string;
    punch2Prefix: string;
    punch2Emphasis: string;
    punch2Suffix: string;
    wins: string[];
    closing: string;
  };
  howItWorks: {
    title: string;
    steps: { phase: string; body: string }[];
  };
  showcase: {
    title: string;
    /** Optional — omitted when empty */
    subtitle?: string;
    items: { icon: string; title: string; desc: string }[];
  };
  valueStack: {
    title: string;
    benefits: string[];
    closingLine1: string;
    closingLine2: string;
  };
  proof: {
    title: string;
    subtitle?: string;
    /** Optional stat tiles — omit for quote-only social proof */
    stats?: { value: string; label: string }[];
    quotes: { text: string; attribution: string }[];
  };
  pricing: {
    title: string;
    subtitle?: string;
    freePlanName: string;
    premiumPlanName: string;
    freeFeatures: string[];
    premiumFeatures: string[];
    /** e.g. Plans starting at $29/month */
    footnote: string;
    freeCta: string;
    premiumCta: string;
  };
  finalCta: {
    title: string;
    line1: string;
    line2: string;
    primary: string;
    /** Optional second button (e.g. Talk to sales) */
    secondary?: string;
  };
};

const agentCopy: LandingCopy = {
  hero: {
    eyebrow: "The AI Growth Engine for Real Estate Agents",
    headline: "Turn Online Traffic into Closed Deals — Fast",
    line1: "Stop losing deals from cold leads and missed follow-ups.",
    line2: "Capture, qualify, and convert high-intent buyers automatically with AI.",
    line3: "No setup. No tech skills required. Start generating leads in minutes.",
    primaryCta: "Get Started Free",
    secondaryCta: "See Demo",
    trustLine: "Trusted by agents generating high-intent buyer and seller leads daily",
  },
  problem: {
    title: "You don’t have a traffic problem.",
    subtitle: "You have a conversion problem.",
    intro: "You’re already getting visitors…",
    painLabel: "But:",
    pains: [
      "They don’t respond",
      "They’re not serious",
      "You forget to follow up",
      "Deals fall through the cracks",
    ],
    closingLead: "Every day this continues…",
    closingEmphasis: "You’re losing real money.",
  },
  solution: {
    title: "LeadSmart AI turns your traffic into a deal-closing machine.",
    punch1: "We don’t just give you leads.",
    punch2Prefix: "We help you ",
    punch2Emphasis: "CLOSE",
    punch2Suffix: " them.",
    wins: [
      "Capture high-intent users from home value & mortgage tools",
      "Automatically qualify and score every lead",
      "Instantly follow up using AI",
      "Prioritize serious buyers and sellers",
      "Route leads to the right agent at the right time",
    ],
    closing: "All on autopilot.",
  },
  howItWorks: {
    title: "Simple. Automated. Powerful.",
    steps: [
      {
        phase: "Attract",
        body: "Users visit your tools (home value, mortgage, property comparison)",
      },
      {
        phase: "Capture",
        body: "We convert them into high-intent leads",
      },
      {
        phase: "Close",
        body: "AI follows up, nurtures, and helps you close the deal",
      },
    ],
  },
  showcase: {
    title: "Everything You Need to Turn Interest into Income",
    items: [
      {
        icon: "📊",
        title: "Smart Dashboard",
        desc: "See all your leads, scores, and activity in one place",
      },
      {
        icon: "🧠",
        title: "AI Lead Scoring",
        desc: "Instantly identify who is ready to buy or sell",
      },
      {
        icon: "📩",
        title: "Automated Follow-Up",
        desc: "Never miss a lead again — AI responds instantly",
      },
      {
        icon: "🏡",
        title: "AI Property Comparison",
        desc: "Help clients choose the best property with data-driven insights",
      },
    ],
  },
  valueStack: {
    title: "Why Agents Choose LeadSmart AI",
    benefits: [
      "More qualified buyer & seller conversations",
      "Faster response time on every lead",
      "Higher conversion from traffic you already have",
      "Less manual follow-up and admin",
      "A pipeline you can see and act on daily",
    ],
    closingLine1: "This isn’t just a tool.",
    closingLine2: "It’s your unfair advantage.",
  },
  proof: {
    title: "Agents Are Already Seeing Results",
    quotes: [
      {
        text: "Got 12 qualified leads in just one week",
        attribution: "Real Estate Agent",
      },
      {
        text: "My response rate doubled overnight",
        attribution: "Loan Broker",
      },
      {
        text: "These are the first leads that actually convert",
        attribution: "Investor",
      },
    ],
  },
  pricing: {
    title: "Start Free. Upgrade When You’re Ready.",
    freePlanName: "Free Plan",
    premiumPlanName: "Premium Plan",
    freeFeatures: ["Basic tools", "Limited leads", "Standard features"],
    premiumFeatures: [
      "Unlimited lead capture",
      "Advanced AI tools",
      "Full automation",
      "Priority lead routing",
    ],
    footnote: "Plans starting at $29/month",
    freeCta: "Get Started Free",
    premiumCta: "View plans & upgrade",
  },
  finalCta: {
    title: "Stop Wasting Traffic. Start Closing Deals.",
    line1: "Every visitor you don’t convert is a lost opportunity.",
    line2: "Let AI work for you — 24/7.",
    primary: "Get Started Free",
  },
};

const brokerCopy: LandingCopy = {
  hero: {
    eyebrow: "The AI Growth Engine for Financing Brokers",
    headline: "Turn Mortgage Traffic into Closed Deals — Fast",
    line1: "Capture and convert high-intent loan clients automatically with AI.",
    primaryCta: "Get Started Free",
    secondaryCta: "See Demo",
    trustLine: "Trusted by brokers turning mortgage traffic into qualified applications daily",
  },
  problem: {
    title: "You don’t have a traffic problem.",
    subtitle: "You have a conversion problem.",
    intro: "Borrowers are already hitting your site and tools…",
    painLabel: "But:",
    pains: [
      "They ghost after the first touch",
      "Too many tire-kickers burn LO time",
      "Follow-up slips when pipelines get busy",
      "Funded deals fall through the cracks",
    ],
    closingLead: "Every day this continues…",
    closingEmphasis: "You’re leaving revenue on the table.",
  },
  solution: {
    title: "LeadSmart AI turns your traffic into a deal-closing machine.",
    punch1: "We don’t just give you applications.",
    punch2Prefix: "We help you ",
    punch2Emphasis: "FUND",
    punch2Suffix: " them.",
    wins: [
      "Capture high-intent borrowers from mortgage & home-financing tools",
      "Automatically qualify and score every opportunity",
      "Instantly follow up using AI",
      "Prioritize serious borrowers and referral partners",
      "Route files to the right LO at the right time",
    ],
    closing: "All on autopilot.",
  },
  howItWorks: {
    title: "Simple. Automated. Powerful.",
    steps: [
      {
        phase: "Attract",
        body: "Borrowers hit your tools (rates, pre-qual, home value, property comparison)",
      },
      {
        phase: "Capture",
        body: "We convert them into high-intent opportunities",
      },
      {
        phase: "Close",
        body: "AI follows up, nurtures, and helps your team fund more deals",
      },
    ],
  },
  showcase: {
    title: "Everything You Need to Turn Interest into Income",
    items: [
      {
        icon: "📊",
        title: "Smart Dashboard",
        desc: "See pipelines, scores, and team activity in one place",
      },
      {
        icon: "🧠",
        title: "AI Lead Scoring",
        desc: "Instantly spot who’s ready to move forward",
      },
      {
        icon: "📩",
        title: "Automated Follow-Up",
        desc: "Never miss a borrower — AI responds instantly and stays compliant",
      },
      {
        icon: "🏡",
        title: "AI Property Comparison",
        desc: "Help clients compare scenarios with clear, data-backed insights",
      },
    ],
  },
  valueStack: {
    title: "Why Brokers Choose LeadSmart AI",
    benefits: [
      "More qualified opportunities",
      "Faster response time",
      "Higher pull-through & fund rates",
      "Less manual work for your team",
      "More predictable pipeline revenue",
    ],
    closingLine1: "This isn’t just a tool.",
    closingLine2: "It’s your unfair advantage.",
  },
  proof: {
    title: "Agents Are Already Seeing Results",
    quotes: [
      {
        text: "Got 12 qualified leads in just one week",
        attribution: "Real Estate Agent",
      },
      {
        text: "My response rate doubled overnight",
        attribution: "Loan Broker",
      },
      {
        text: "These are the first leads that actually convert",
        attribution: "Investor",
      },
    ],
  },
  pricing: {
    title: "Start Free. Upgrade When You’re Ready.",
    freePlanName: "Free Plan",
    premiumPlanName: "Premium Plan",
    freeFeatures: ["Basic tools", "Limited leads", "Standard features"],
    premiumFeatures: [
      "Unlimited lead capture",
      "Advanced AI tools",
      "Full automation",
      "Priority lead routing",
    ],
    footnote: "Plans starting at $29/month",
    freeCta: "Get Started Free",
    premiumCta: "View plans & upgrade",
  },
  finalCta: {
    title: "Stop Wasting Traffic. Start Closing Deals.",
    line1: "Every borrower you don’t convert is a lost opportunity.",
    line2: "Let AI work for you — 24/7.",
    primary: "Get Started Free",
  },
};

export function getLandingCopy(role: UserRole): LandingCopy {
  return role === "broker" ? brokerCopy : agentCopy;
}

export const ROLE_STORAGE_KEY = "leadsmart_landing_role";
