import type { LeadId } from "./lead";

export type LeadActivityEventId = string;

export type LeadActivityEvent = {
  id: LeadActivityEventId;
  leadId: LeadId;
  eventType: string;
  title: string | null;
  description: string | null;
  source: string | null;
  actorType: "agent" | "system" | "ai" | "lead" | string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};
