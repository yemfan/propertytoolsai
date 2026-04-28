import type { AgentPlan } from "./types";

/** Canonical plan ids stored in product_entitlements.plan */
export const AGENT_PLANS = ["starter", "growth", "elite"] as const;

export type PlanCatalogEntry = {
  label: string;
  cmaReportsPerDay: number;
  /** null = unlimited (Elite); negative kept for legacy parity */
  maxLeads: number | null;
  maxContacts: number | null;
  alertsLevel: "basic" | "full" | "advanced";
  reportsDownloadLevel: "limited" | "full" | "unlimited";
  teamAccess: boolean;
  /** Maximum members on a team (including owner). Null = unlimited.
   *  0 means the plan can't run a team — paired with teamAccess=false.
   *  Owner counts as one seat; pending invites also occupy a seat so
   *  the owner can't oversubscribe by inviting many emails at once. */
  teamSeatCap: number | null;
  /**
   * Monthly cap on AI-bearing actions (deal review, growth opps,
   * AI SMS draft, AI deal commentary, etc.). NULL = unlimited.
   * CMA reports are NOT counted here — they have their own daily
   * cap via `cmaReportsPerDay`.
   */
  aiActionsPerMonth: number | null;
  /** Marketing bullets for comparison UI */
  bullets: string[];
};

/** -1 = unlimited for numeric caps */
export const PLAN_CATALOG: Record<AgentPlan, PlanCatalogEntry> = {
  starter: {
    label: "Starter",
    cmaReportsPerDay: 2,
    maxLeads: 5,
    maxContacts: 50,
    alertsLevel: "basic",
    reportsDownloadLevel: "limited",
    teamAccess: false,
    teamSeatCap: 0,
    aiActionsPerMonth: 100,
    bullets: [
      "Up to 5 leads · 50 contacts",
      "2 CMA reports / day",
      "AI SMS + email responder (basic)",
      "Click-to-call (Twilio bridge)",
      "Custom fields on contacts",
      "Reviews & testimonial capture",
      "Mobile app",
      "100 AI actions / month",
    ],
  },
  growth: {
    label: "Pro",
    cmaReportsPerDay: 5,
    maxLeads: 500,
    maxContacts: 500,
    alertsLevel: "full",
    reportsDownloadLevel: "full",
    teamAccess: false,
    teamSeatCap: 0,
    aiActionsPerMonth: 5000,
    bullets: [
      "Everything in Starter, plus:",
      "Up to 500 leads · 500 contacts",
      "5 CMA reports / day",
      "Email open / click tracking",
      "Video email (record & send)",
      "Newsletter / mass-email composer",
      "Listing presentation builder",
      "Vanity / call-tracking numbers",
      "Sphere prediction + equity signals",
      "Buyer Broker Agreement (BBA) workflow",
      "5,000 AI actions / month",
    ],
  },
  elite: {
    label: "Elite",
    cmaReportsPerDay: 10,
    maxLeads: null,
    maxContacts: null,
    alertsLevel: "advanced",
    reportsDownloadLevel: "unlimited",
    teamAccess: true,
    teamSeatCap: 10,
    aiActionsPerMonth: null,
    bullets: [
      "Everything in Pro, plus:",
      "Unlimited leads & contacts",
      "Team accounts: up to 10 seats",
      "Round-robin lead routing across team",
      "ISA workflow + qualified handoff",
      "Per-member breakdown reporting",
      "Roster-wide dashboard rollups",
      "E-signature workflow (Dotloop / DocuSign)",
      "Advanced AI coaching + peer benchmarks",
      "Unlimited AI actions",
      "Priority support",
    ],
  },
};

export function planRowFromCatalog(plan: AgentPlan): {
  plan: string;
  cma_reports_per_day: number;
  max_leads: number | null;
  max_contacts: number | null;
  alerts_level: string;
  reports_download_level: string;
  team_access: boolean;
  ai_actions_per_month: number | null;
} {
  const p = PLAN_CATALOG[plan];
  return {
    plan,
    cma_reports_per_day: p.cmaReportsPerDay,
    max_leads: p.maxLeads,
    max_contacts: p.maxContacts,
    alerts_level: p.alertsLevel,
    reports_download_level: p.reportsDownloadLevel,
    team_access: p.teamAccess,
    ai_actions_per_month: p.aiActionsPerMonth,
  };
}
