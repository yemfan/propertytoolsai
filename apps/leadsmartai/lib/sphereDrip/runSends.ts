import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

import { BOTH_HIGH_CADENCE_KEY } from "./cadence";
import {
  processSphereDripSendsForAgent,
  type SendProcessorAgentResult,
} from "./sendProcessor";

/**
 * Multi-agent runner for the sphere-drip send pipeline. Walks every
 * agent that has at least one due active enrollment and invokes the
 * processor per-agent. Pilot opt-in via `SPHERE_DRIP_ENABLED_AGENT_IDS`
 * env (same allowlist gating the enroll cron uses) so we can flip the
 * send pipeline on agent-by-agent.
 *
 * The send processor itself is the part that creates message_drafts
 * + advances the cadence step. The actual SMS/email delivery rides
 * the existing sphere-drafts-sender cron, which fires every 15 minutes
 * and respects all the timing guardrails (quiet hours, Sunday morning,
 * per-contact cap, etc.).
 */

export type RunSendsOptions = {
  /** Limit to one agent (skips the broad query). */
  agentId?: string;
  /** Compute outcomes without writing anything. */
  dryRun?: boolean;
  /** Override the allowlist (manual one-off testing). */
  forceProcess?: boolean;
};

export type RunSendsAgentResult = SendProcessorAgentResult & {
  ok: boolean;
  error?: string;
};

export type RunSendsResult = {
  agentsConsidered: number;
  agentsProcessed: number;
  perAgent: RunSendsAgentResult[];
};

export async function runSphereDripSends(
  opts: RunSendsOptions = {},
): Promise<RunSendsResult> {
  const allowlist = parseAllowlist(process.env.SPHERE_DRIP_ENABLED_AGENT_IDS);
  const allowlistSet = new Set(allowlist);

  const candidateAgentIds = opts.agentId
    ? [opts.agentId]
    : await listAgentsWithDueEnrollments();

  const targets = candidateAgentIds.filter((id) => {
    if (opts.forceProcess) return true;
    return allowlistSet.has(id);
  });

  const perAgent: RunSendsAgentResult[] = [];
  for (const agentId of targets) {
    try {
      const r = await processSphereDripSendsForAgent(agentId, {
        dryRun: opts.dryRun,
      });
      perAgent.push({ ...r, ok: true });
    } catch (e) {
      perAgent.push({
        agentId,
        due: 0,
        drafted: 0,
        skipped: 0,
        exited: 0,
        completed: 0,
        outcomes: [],
        ok: false,
        error: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  return {
    agentsConsidered: candidateAgentIds.length,
    agentsProcessed: perAgent.length,
    perAgent,
  };
}

/**
 * Find every distinct agent_id with at least one active enrollment that's
 * already past its next_due_at. Bounds the cron's outer loop to agents
 * who actually have work to do — avoids walking idle accounts every
 * tick.
 */
async function listAgentsWithDueEnrollments(): Promise<string[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("sphere_drip_enrollments")
    .select("agent_id")
    .eq("status", "active")
    .eq("cadence_key", BOTH_HIGH_CADENCE_KEY)
    .lte("next_due_at", nowIso)
    .limit(10000);
  if (error) {
    console.warn("[sphere-drip-send] listAgentsWithDueEnrollments failed:", error.message);
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
