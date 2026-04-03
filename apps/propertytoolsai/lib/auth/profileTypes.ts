import type { UserRole } from "./roles";

export type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  /** PropertyTools consumer tier (`propertytools_users.tier`); staff rely on `role`. */
  tier?: "basic" | "premium";
  created_at: string;
  updated_at: string;
  /** CRM agent id (`public.agents.id` as text) when set on profile. */
  agent_id?: string | null;
  broker_id?: string | null;
  support_id?: string | null;
};
