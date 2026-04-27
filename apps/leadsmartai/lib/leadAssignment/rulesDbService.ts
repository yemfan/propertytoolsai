import "server-only";

import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabase/admin";

import {
  buildRoutingConfigFromRows,
  type RoutingConfig,
  type RoutingRuleRow,
} from "@/lib/leadAssignment/routingRules";

/**
 * DB-backed routing-rules service.
 *
 * The picker pipeline (lib/leadAssignment/service.ts) queries this first;
 * if the result is empty (no agents have opted into the pool yet) it
 * falls back to the env allowlist. That keeps the migration non-breaking:
 * existing env-driven setups keep routing leads, and switchover happens
 * the moment any agent toggles "in routing pool" via the settings UI.
 *
 * All reads use the service-role client (bypassing RLS) because the
 * picker runs from an unauthenticated public route (the IDX form post).
 * Writes from the settings UI use the anon-key client, which goes through
 * RLS and only lets an agent edit their own row.
 */

export type DbRoutingConfig = RoutingConfig & {
  /** Convenience flag — true if the DB has any enrolled rows. Used by the
   *  picker to decide whether to fall back to env allowlist. */
  hasEnrolledRows: boolean;
};

/**
 * Load the routing config from DB. Returns an empty config (and
 * hasEnrolledRows=false) on any error so the picker degrades safely
 * to the env allowlist instead of failing the IDX lead-capture flow.
 */
export async function loadRoutingConfigFromDb(): Promise<DbRoutingConfig> {
  try {
    const { data, error } = await supabaseAdmin
      .from("agent_lead_routing")
      .select("agent_id, in_round_robin, zip_coverage, priority")
      .eq("in_round_robin", true);
    if (error) {
      console.warn(
        "[lead-assignment] loadRoutingConfigFromDb query failed:",
        error.message,
      );
      return { allowlist: [], coverage: new Map(), hasEnrolledRows: false };
    }
    const rows = ((data ?? []) as Array<{
      agent_id: string | number | null;
      in_round_robin: boolean | null;
      zip_coverage: string[] | null;
      priority: number | null;
    }>)
      .filter((r) => r.agent_id != null)
      .map<RoutingRuleRow>((r) => ({
        agentId: String(r.agent_id),
        inRoundRobin: Boolean(r.in_round_robin),
        zipCoverage: Array.isArray(r.zip_coverage) ? r.zip_coverage : [],
        priority: typeof r.priority === "number" ? r.priority : 0,
      }));

    const cfg = buildRoutingConfigFromRows(rows);
    return {
      allowlist: cfg.allowlist,
      coverage: cfg.coverage,
      hasEnrolledRows: cfg.allowlist.length > 0,
    };
  } catch (e) {
    console.warn("[lead-assignment] loadRoutingConfigFromDb threw", e);
    return { allowlist: [], coverage: new Map(), hasEnrolledRows: false };
  }
}

// ── Settings-UI side: per-agent CRUD via RLS-scoped server client ─────

export type AgentRoutingRule = {
  agentId: string;
  inRoundRobin: boolean;
  zipCoverage: string[];
  priority: number;
  updatedAt: string | null;
};

/**
 * Read this agent's routing rule (if any). Returns a deterministic
 * "default" row when the agent has never saved a rule, so the UI can
 * render a clean form without checking for null.
 */
export async function getAgentRoutingRule(
  agentId: string,
): Promise<AgentRoutingRule> {
  const { data, error } = await supabaseServer
    .from("agent_lead_routing")
    .select("agent_id, in_round_robin, zip_coverage, priority, updated_at")
    .eq("agent_id", agentId)
    .maybeSingle();
  if (error) {
    // Soft-fail: treat as "no rule" so the form still renders.
    console.warn("[lead-assignment] getAgentRoutingRule failed:", error.message);
    return defaultRule(agentId);
  }
  if (!data) return defaultRule(agentId);
  const row = data as {
    agent_id: string | number;
    in_round_robin: boolean | null;
    zip_coverage: string[] | null;
    priority: number | null;
    updated_at: string | null;
  };
  return {
    agentId: String(row.agent_id),
    inRoundRobin: Boolean(row.in_round_robin),
    zipCoverage: Array.isArray(row.zip_coverage) ? row.zip_coverage : [],
    priority: typeof row.priority === "number" ? row.priority : 0,
    updatedAt: row.updated_at ?? null,
  };
}

/**
 * Upsert the agent's routing rule. The `agent_id` PK + RLS policy ensure
 * the user can only write to their own row; we don't need any extra
 * server-side ownership check here. Returns the row we wrote (with
 * the trigger-stamped `updated_at`).
 */
export async function upsertAgentRoutingRule(input: {
  agentId: string;
  inRoundRobin: boolean;
  zipCoverage: string[];
  priority?: number;
}): Promise<AgentRoutingRule> {
  const payload = {
    agent_id: input.agentId,
    in_round_robin: input.inRoundRobin,
    zip_coverage: input.zipCoverage,
    priority: input.priority ?? 0,
  };

  const { data, error } = await supabaseServer
    .from("agent_lead_routing")
    .upsert(payload, { onConflict: "agent_id" })
    .select("agent_id, in_round_robin, zip_coverage, priority, updated_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to save routing rule");
  }
  const row = data as {
    agent_id: string | number;
    in_round_robin: boolean | null;
    zip_coverage: string[] | null;
    priority: number | null;
    updated_at: string | null;
  };
  return {
    agentId: String(row.agent_id),
    inRoundRobin: Boolean(row.in_round_robin),
    zipCoverage: Array.isArray(row.zip_coverage) ? row.zip_coverage : [],
    priority: typeof row.priority === "number" ? row.priority : 0,
    updatedAt: row.updated_at ?? null,
  };
}

function defaultRule(agentId: string): AgentRoutingRule {
  return {
    agentId,
    inRoundRobin: false,
    zipCoverage: [],
    priority: 0,
    updatedAt: null,
  };
}
