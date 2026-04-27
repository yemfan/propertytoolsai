import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

import {
  enrollEligibleContactsForAgent,
  type EnrollmentRunResult,
} from "./service";

/**
 * Multi-agent runner. Walks every agent that owns past-client / sphere
 * contacts and runs the enrollment service for each. Drives the daily
 * cron at /api/cron/sphere-drip-enroll.
 *
 * Pilot opt-in: only agents in the `SPHERE_DRIP_ENABLED_AGENT_IDS`
 * env allowlist are processed. Empty / missing → no agents run, which
 * is the safe default during rollout. We'll promote this to a DB-backed
 * per-agent toggle in a follow-up (same migration story as the
 * IDX-routing rules in PR #165).
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
  const allowlist = parseAllowlist(process.env.SPHERE_DRIP_ENABLED_AGENT_IDS);
  const allowlistSet = new Set(allowlist);

  const candidateAgentIds = opts.agentId
    ? [opts.agentId]
    : await listAgentsWithSphereContacts();

  const targets = candidateAgentIds.filter((id) => {
    if (opts.forceProcess) return true;
    return allowlistSet.has(id);
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

function parseAllowlist(raw: string | null | undefined): string[] {
  if (!raw || typeof raw !== "string") return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}
