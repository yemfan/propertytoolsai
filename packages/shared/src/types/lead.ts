import type { LeadTemperatureLevel } from "../constants/lead-temperature";
import type { LeadIntent } from "../constants/lead-intent";

/** Stable string id from API (numeric ids are still strings in JSON). */
export type LeadId = string;

/**
 * Normalized lead (camelCase) for app layers.
 * Dashboard JSON uses {@link LeadRowSnake}; CRM-heavy views may use {@link LeadCrm}.
 */
export type Lead = {
  id: LeadId;
  agentId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  propertyAddress: string | null;
  city: string | null;
  state: string | null;
  source: string | null;
  leadStatus: string | null;
  temperature: LeadTemperatureLevel | null;
  intent: LeadIntent | null;
  lastContactedAt: string | null;
  lastActivityAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};
