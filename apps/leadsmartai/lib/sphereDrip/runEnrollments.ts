import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

import { listEnabledAgentIdsFromDb } from "./prefsDbService";
import {
  enrollEligibleContactsForAgent,
  type EnrollmentRunResult,
} from "./service";

/**
 * Multi-agent runner. Walks every agent that owns past-client / sphere
 * contacts and runs the enrollment service for each. Drives the daily
 * cron at /api/cron/sphere-drip-enroll.
 *
 * Resolution order (PR-O):
 *   1. DB row in agent_sphere_drip_prefs with enabled=true → process
 *   2. SPHERE_DRIP_ENABLED_AGENT_IDS env allowlist (back-compat) →
 *      processed UNLESS the agent has a DB row with enabled=false
 *   3. Otherwise → skipped
 *
 * Empty / missing on both sides → no agents run (safe default during
 * rollout). The `?force=1` query param on the cron route still bypasses
 * the gate for one-off testing.
 */

export type RunEnrollmentsOptions = {
  agentId?: string;
  dryRun?: boolean;
  /** Override the allowlist (useful for tests / one-off agentId targeting). */
  forceProcess?: boolean;
};

export type RunEnrollmentsAgentResult = EnrollmentRunResult & {
  agentId: string;
  ok: boolean;
  error?: string;
};

export type RunEnrollmentsResult = {
  agentsConsidered: number;
  agentsProcessed: number;
  perAgent: RunEnrollmentsAgentResult[];
};

export async function runSphereDripEnrollments(
  opts: RunEnrollmentsOptions = {},
): Promise<RunEnrollmentsResult> {
  const enabledIds = await listEnabledAgentIdsFromDb();
  const enabledSet = new Set(enabledIds);

  const candidateAgentIds = opts.agentId
    ? [opts.agentId]
    : await listAgentsWithSphereContacts();

  const targets = candidateAgentIds.filter((id) => {
    if (opts.forceProcess) return true;
    return enabledSet.has(id);
  });

  const perAgent: RunEnrollmentsAgentResult[] = [];
  for (const agentId of targets) {
    try {
      const r = await enrollEligibleContactsForAgent(agentId, {
        dryRun: opts.dryRun,
      });
      perAgent.push({ ...r, agentId, ok: true });
    } catch (e) {
      perAgent.push({
        agentId,
        ok: false,
        error: e instanceof Error ? e.message : "Unknown error",
        bothHighEligible: 0,
        alreadyEnrolled: 0,
        newlyEnrolled: 0,
        exited: 0,
      });
    }
  }

  return {
    agentsConsidered: candidateAgentIds.length,
    agentsProcessed: perAgent.length,
    perAgent,
  };
}

async function listAgentsWithSphereContacts(): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("contacts")
    .select("agent_id")
    .in("lifecycle_stage", ["past_client", "sphere"] as never)
    .limit(10000);
  if (error) {
    console.warn("[sphere-drip] listAgentsWithSphereContacts failed:", error.message);
    return [];
  }
  const s = new Set<string>();
  for (const r of data ?? []) {
    const id = (r as { agent_id?: string | number | null }).agent_id;
    if (id != null) s.add(String(id));
  }
  return Array.from(s);
}
