import type { ClientPortalLead } from "@/lib/clientPortalContext";

export type ClientRecommendation = {
  id: string;
  title: string;
  detail: string;
  priority: "high" | "medium" | "low";
};

/**
 * Rule-based next actions for the client dashboard (no AI required).
 */
export function buildClientRecommendations(lead: ClientPortalLead | null): ClientRecommendation[] {
  if (!lead) {
    return [
      {
        id: "link-lead",
        title: "Link your deal",
        detail:
          "Sign in with the same email your agent has on file, or ask them to update your contact email in LeadSmart AI.",
        priority: "high",
      },
    ];
  }

  const recs: ClientRecommendation[] = [];

  if (!lead.property_address?.trim()) {
    recs.push({
      id: "pick-address",
      title: "Confirm your target property",
      detail: "Share the address or neighborhood you are focused on so your agent can prep comps and strategy.",
      priority: "high",
    });
  }

  if (lead.price_min == null && lead.price_max == null) {
    recs.push({
      id: "budget",
      title: "Clarify budget",
      detail: "Even a rough range helps your agent structure tours and offers faster.",
      priority: "medium",
    });
  }

  if (lead.report_id) {
    recs.push({
      id: "read-report",
      title: "Review your home value report",
      detail: "Open the report in Documents to understand pricing context before you offer.",
      priority: "medium",
    });
  }

  if ((lead.ai_lead_score ?? 0) >= 70) {
    recs.push({
      id: "move-fast",
      title: "High-intent window",
      detail:
        "Signals suggest you are close to decision — book time with your agent this week to lock a plan.",
      priority: "high",
    });
  }

  recs.push({
    id: "message-agent",
    title: "Message your agent",
    detail: "Ask questions anytime in Chat — your agent sees updates on their LeadSmart AI dashboard.",
    priority: "low",
  });

  return recs.slice(0, 6);
}
