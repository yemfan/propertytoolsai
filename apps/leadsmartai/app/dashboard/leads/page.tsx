import { redirect } from "next/navigation";

/**
 * The old /dashboard/leads route is now part of the unified contacts hub.
 * Redirect to /dashboard/contacts — the first Smart List there (seeded as
 * "Leads") filters to lifecycle_stage IN (lead, active_client), preserving
 * the agent's mental model.
 *
 * The legacy LeadsClient implementation lives in this folder's git history
 * (reachable via `git log`) if it ever needs to be referenced.
 */
export default function LegacyLeadsPage() {
  redirect("/dashboard/contacts");
}
