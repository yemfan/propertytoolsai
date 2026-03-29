import type { ReengagementLead, ReengagementTriggerType } from "./types";

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / (1000 * 60 * 60 * 24);
}

function referenceTimestamp(lead: ReengagementLead, trigger: ReengagementTriggerType): string | null {
  if (trigger === "no_activity") {
    return lead.lastActivityAt || lead.lastContactedAt;
  }
  if (trigger === "cold_lead") {
    return lead.lastContactedAt || lead.lastActivityAt;
  }
  return lead.lastContactedAt || lead.lastActivityAt;
}

/**
 * Whether the lead is inactive long enough for this campaign trigger.
 */
export function isColdLead(lead: ReengagementLead, days: number, trigger: ReengagementTriggerType = "cold_lead") {
  const ref = referenceTimestamp(lead, trigger);
  if (!ref) return true;
  const diff = daysSince(ref);
  if (diff === null) return true;
  return diff >= days;
}
