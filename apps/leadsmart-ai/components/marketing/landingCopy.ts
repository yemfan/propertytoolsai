export type UserRole = "agent" | "broker";

export type LandingCopy = {
  hero: {
    eyebrow: string;
    headline: string;
    subhead: string;
    supporting: string;
    primaryCta: string;
    secondaryCta: string;
    trustLine: string;
  };
  problem: {
    title: string;
    subtitle: string;
    points: { title: string; body: string }[];
  };
  solution: {
    title: string;
    subtitle: string;
    bullets: { title: string; body: string }[];
  };
  steps: { phase: string; title: string; body: string }[];
  showcase: {
    title: string;
    subtitle: string;
    items: { title: string; desc: string }[];
  };
  proof: {
    title: string;
    subtitle: string;
    stats: { value: string; label: string }[];
    quotes: { text: string; attribution: string }[];
  };
  pricing: {
    title: string;
    subtitle: string;
  };
  finalCta: {
    title: string;
    subtitle: string;
    primary: string;
    secondary: string;
  };
  footerTagline: string;
};

const agentCopy: LandingCopy = {
  hero: {
    eyebrow: "The AI Growth Engine for Real Estate Agents",
    headline: "Turn Online Traffic into Closed Deals — Fast",
    subhead: "Capture high-intent sellers from home-value and listing tools, qualify automatically, and keep follow-up consistent—without hiring a full-time ISA team.",
    supporting:
      "LeadSmart AI runs the funnel: traffic → lead → nurture → booked appointment. You focus on conversations that close.",
    primaryCta: "Get Started Free",
    secondaryCta: "See Demo",
    trustLine: "No credit card to start · Live in minutes · Built for production agents",
  },
  problem: {
    title: "Your pipeline isn’t broken—your follow-up is",
    subtitle:
      "Most agents don’t lose deals to skill. They lose them to speed, noise, and forgotten leads.",
    points: [
      {
        title: "Painfully low conversion",
        body: "Traffic hits your site, fills a form, then goes quiet—because nobody responds in the conversion window that actually matters.",
      },
      {
        title: "Leads that look good on paper",
        body: "Names and emails without intent scoring means you chase the wrong people while hot sellers go cold.",
      },
      {
        title: "Inconsistent follow-up",
        body: "Inbox fire drills, sticky notes, and “I’ll call tomorrow” guarantees tomorrow never happens for half your pipeline.",
      },
    ],
  },
  solution: {
    title: "AI that captures, qualifies, and follows up—like a revenue team",
    subtitle: "One growth engine that turns intent into pipeline you can work today—not someday.",
    bullets: [
      {
        title: "Automated capture & routing",
        body: "High-intent flows (home value, CMA, mortgage calculators) feed your CRM with context—not just fields.",
      },
      {
        title: "Qualification without the grunt work",
        body: "Signals and scoring surface who’s warming up so you spend time on closable conversations.",
      },
      {
        title: "Follow-up that doesn’t feel robotic",
        body: "Sequences across email & SMS keep sellers moving—so deals don’t die in the gap between interest and appointment.",
      },
      {
        title: "Outcomes you can measure",
        body: "See what channels and campaigns create real replies and booked calls—not vanity clicks.",
      },
    ],
  },
  steps: [
    {
      phase: "Attract",
      title: "Drive traffic with tools sellers actually use",
      body: "Deploy AI-assisted valuation and comparison experiences that pull in serious homeowners—not tire-kickers.",
    },
    {
      phase: "Capture",
      title: "Turn interest into qualified pipeline",
      body: "Every submission lands in one place with source, property context, and next-best-action—automatically.",
    },
    {
      phase: "Close",
      title: "Book more listing appointments",
      body: "Alerts, playbooks, and persistent nurture push the right leads toward a calendar slot—while you’re on showings.",
    },
  ],
  showcase: {
    title: "Everything in one command center",
    subtitle: "Built for agents who sell listings—not spreadsheets.",
    items: [
      {
        title: "Agent dashboard",
        desc: "Today’s hottest opportunities, pipeline health, and tasks—without tab overload.",
      },
      {
        title: "Lead scoring & signals",
        desc: "See who’s engaging before you pick up the phone—prioritize like a top producer.",
      },
      {
        title: "Auto follow-up",
        desc: "Email & SMS sequences that stay compliant, on-brand, and relentless on your behalf.",
      },
      {
        title: "AI comparison & CMA tools",
        desc: "Reports sellers read and trust—so you win the narrative before the listing appointment.",
      },
    ],
  },
  proof: {
    title: "Trusted by teams who count conversations—not clicks",
    subtitle:
      "Agents use LeadSmart AI to tighten response time, reduce lead decay, and show up with proof—not promises.",
    stats: [
      { value: "<24h", label: "Structured first touch vs. inbox chaos" },
      { value: "24/7", label: "Capture while you’re on appointments" },
      { value: "1 pipeline", label: "Leads, tasks, and nurture in one place" },
    ],
    quotes: [
      {
        text: "We stopped losing sellers to silence. The handoff from tool to follow-up is finally instant—and trackable.",
        attribution: "Listing team lead · Southwest market",
      },
      {
        text: "I can see who’s heating up before I call. That alone paid for the upgrade in the first month.",
        attribution: "Top producer · referral-heavy book",
      },
    ],
  },
  pricing: {
    title: "Start free. Scale when it’s printing ROI.",
    subtitle: "Upgrade for higher limits, full CRM, automations, and team-ready workflows.",
  },
  finalCta: {
    title: "Ready to turn traffic into signed business?",
    subtitle: "Join agents using LeadSmart AI to replace chaos with a pipeline you can run every morning in five minutes.",
    primary: "Get Started Free",
    secondary: "Talk to sales",
  },
  footerTagline: "AI growth engine for agents who measure pipeline in booked conversations.",
};

const brokerCopy: LandingCopy = {
  hero: {
    eyebrow: "The AI Growth Engine for Financing Brokers",
    headline: "Turn Mortgage Traffic into Closed Deals — Fast",
    subhead:
      "Capture borrowers from calculators and pre-qual flows, automate follow-up, and keep your pipeline warm—without another spreadsheet.",
    supporting:
      "LeadSmart AI connects high-intent mortgage traffic to structured nurture so you stay top-of-mind through rate checks and paperwork.",
    primaryCta: "Get Started Free",
    secondaryCta: "See Demo",
    trustLine: "No credit card to start · LOS-friendly workflows · Built for broker production",
  },
  problem: {
    title: "Mortgage marketing creates noise—not always revenue",
    subtitle: "Traffic is easy. Consistent conversion and follow-up separate brokers who scale from those who stall.",
    points: [
      {
        title: "Low conversion from digital traffic",
        body: "Borrowers compare rates everywhere. If your follow-up isn’t immediate and structured, you’re not in the final three.",
      },
      {
        title: "Unqualified “leads” waste LO time",
        body: "Without intent signals, your team chases files that were never going to close this quarter.",
      },
      {
        title: "Follow-up that depends on memory",
        body: "Rate drops, document requests, and referrals slip through when nurture isn’t automated and measurable.",
      },
    ],
  },
  solution: {
    title: "AI that turns mortgage intent into funded pipeline",
    subtitle: "Automate capture, qualification, and nurture—so your LOs work the hottest files first.",
    bullets: [
      {
        title: "Capture from tools borrowers already use",
        body: "Calculators and pre-qual experiences feed your pipeline with structured context—not just form dumps.",
      },
      {
        title: "Qualify before the first call",
        body: "Scoring and engagement signals help your team prioritize speed-to-contact on real opportunity.",
      },
      {
        title: "Nurture that survives busy weeks",
        body: "Sequences keep borrowers moving through milestones so deals don’t stall in silence.",
      },
      {
        title: "Revenue visibility",
        body: "See which campaigns create applications and funded loans—not vanity form fills.",
      },
    ],
  },
  steps: [
    {
      phase: "Attract",
      title: "Bring in high-intent borrowers",
      body: "Mortgage and home-financing tools that convert curiosity into structured leads.",
    },
    {
      phase: "Capture",
      title: "Route & record every opportunity",
      body: "Submissions sync to your CRM with loan context and next steps—automatically.",
    },
    {
      phase: "Close",
      title: "Fund more deals",
      body: "Persistent, compliant follow-up keeps files advancing—so you’re there when they’re ready to lock.",
    },
  ],
  showcase: {
    title: "Built for broker teams who run on throughput",
    subtitle: "Dashboard, scoring, and automation—without enterprise bloat.",
    items: [
      {
        title: "Broker dashboard",
        desc: "Pipeline snapshot: applications in flight, follow-ups due, and team performance.",
      },
      {
        title: "Lead scoring",
        desc: "Surface borrowers who are re-engaging, comparing, or ready for human touch.",
      },
      {
        title: "Auto follow-up",
        desc: "SMS & email cadences tuned for mortgage milestones and compliance.",
      },
      {
        title: "AI comparison tools",
        desc: "Side-by-side scenarios borrowers understand—so you win trust before the application.",
      },
    ],
  },
  proof: {
    title: "Brokers who measure funded loans—not leads",
    subtitle: "Teams use LeadSmart AI to tighten speed-to-contact and reduce drop-off between intent and application.",
    stats: [
      { value: "Speed", label: "First touch while intent is hot" },
      { value: "24/7", label: "Capture after hours and weekends" },
      { value: "1 system", label: "Marketing → nurture → handoff" },
    ],
    quotes: [
      {
        text: "We finally know which campaigns create conversations—not just form fills. LO time went to the right files.",
        attribution: "Branch manager · purchase-heavy market",
      },
      {
        text: "Follow-up used to die in busy weeks. Now nurture keeps borrowers warm until we’re ready to move.",
        attribution: "Mortgage advisor · refi + purchase mix",
      },
    ],
  },
  pricing: {
    title: "Start free. Upgrade when volume demands it.",
    subtitle: "Unlock higher limits, automation, and team features when you’re ready to scale.",
  },
  finalCta: {
    title: "Ready to fund more loans from the same traffic?",
    subtitle: "Join brokers using LeadSmart AI to replace leaky follow-up with a system that runs 24/7.",
    primary: "Get Started Free",
    secondary: "Talk to sales",
  },
  footerTagline: "AI growth engine for financing teams who measure pipeline in funded business.",
};

export function getLandingCopy(role: UserRole): LandingCopy {
  return role === "broker" ? brokerCopy : agentCopy;
}

export const ROLE_STORAGE_KEY = "leadsmart_landing_role";
