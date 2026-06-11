/**
 * RealtorBoss AI team roster — the four-member AI real estate team.
 * Mirrors the HelmSmart `CORE_ROSTER` blueprint shape; apps seed their
 * per-tenant `ai_assistants` rows from this.
 */

export type AssistantType =
  | "boss_assistant"
  | "receptionist"
  | "sales_assistant"
  | "transaction_assistant";

export type AssistantDef = {
  type: AssistantType;
  name: string;
  role: string;
  mission: string;
  href: string;
  /** Skill keys from ./skills.ts */
  skills: readonly string[];
  kpis: readonly string[];
};

export const AI_TEAM: readonly AssistantDef[] = [
  {
    type: "boss_assistant",
    name: "Boss Assistant",
    role: "AI Chief of Staff",
    mission: "Help you focus on the most important actions today.",
    href: "/dashboard/boss",
    skills: [],
    kpis: ["Priorities surfaced", "Briefings delivered", "Risks flagged"],
  },
  {
    type: "receptionist",
    name: "AI Receptionist",
    role: "Inbound communication",
    mission: "Never miss a call.",
    href: "/dashboard/ai-receptionist",
    skills: [
      "lead_capture",
      "faq",
      "buyer_qualification",
      "seller_qualification",
      "appointment_scheduling",
      "transfer",
    ],
    kpis: [
      "Calls answered",
      "Leads captured",
      "Appointments booked",
      "Missed calls recovered",
    ],
  },
  {
    type: "sales_assistant",
    name: "AI Sales Assistant",
    role: "Outbound lead conversion",
    mission: "Never miss a lead.",
    href: "/dashboard/ai-sales-assistant",
    skills: [
      "speed_to_lead",
      "follow_up",
      "reactivation",
      "objection_handling",
      "appointment_scheduling",
      "lead_capture",
    ],
    kpis: [
      "Leads contacted",
      "Follow-ups completed",
      "Appointments booked",
      "Hot leads identified",
    ],
  },
  {
    type: "transaction_assistant",
    name: "AI Transaction Assistant",
    role: "Transaction coordination",
    mission: "Never miss a deadline.",
    href: "/dashboard/ai-transaction-assistant",
    skills: ["transaction_deadlines", "document_reminders"],
    kpis: [
      "Active transactions",
      "Upcoming deadlines",
      "Overdue items",
      "Risk alerts",
    ],
  },
] as const;

export function getAssistant(type: AssistantType): AssistantDef {
  const def = AI_TEAM.find((a) => a.type === type);
  if (!def) throw new Error(`Unknown assistant type: ${type}`);
  return def;
}
