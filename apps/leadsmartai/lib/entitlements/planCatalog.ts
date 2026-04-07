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
    bullets: [
      "CMA reports: 2 per day",
      "Lead management: up to 5 leads",
      "Alerts: basic",
      "CRM: up to 50 contacts",
      "Report downloads: limited",
      "Team access: not included",
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
    bullets: [
      "CMA reports: 5 per day",
      "Lead management: up to 500 leads",
      "Alerts: full + engagement tracking",
      "CRM: up to 500 contacts",
      "Report downloads: full",
      "Team access: not included",
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
    bullets: [
      "CMA reports: 10 per day (expandable)",
      "Lead management: unlimited",
      "Alerts: advanced + automation",
      "CRM: unlimited contacts",
      "Report downloads: unlimited",
      "Team access: included",
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
  };
}
