import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabaseServer";

import {
  parseDripEnabledAgentIds,
  resolveDripEnabled,
  type DripEnabledResolution,
} from "./enabledResolver";

/**
 * Server reads + writes for the per-agent sphere-drip toggle (PR-O).
 *
 *   listEnabledAgentIdsFromDb()     — used by the cron runners
 *                                     (runEnrollments, runSends) to
 *                                     pick which agents to process.
 *                                     Returns the union of DB-enabled
 *                                     and env-allowlisted agents,
 *                                     minus anyone explicitly DB-disabled.
 *   getEffectiveForAgent(agentId)   — used by the settings panel API
 *                                     to render current state.
 *   upsertPrefsForAgent({...})      — used by the PATCH endpoint;
 *                                     RLS-scoped via supabaseServer.
 *
 * Reads from agent_sphere_drip_prefs use service-role from the cron
 * (no auth context); the GET endpoint that drives the settings panel
 * uses supabaseServer (anon key with RLS) so RLS enforces ownership
 * even though the helper here uses admin for the lookup.
 */

export type AgentDripPrefs = {
  agentId: string;
  enabled: boolean;
  notes: string | null;
  updatedAt: string | null;
};

export type EffectiveAgentDripPrefs = AgentDripPrefs & DripEnabledResolution;

/**
 * Cron-side resolution. Walks the DB for explicit prefs, layers the
 * env allowlist, and returns the set of agent ids to process.
 *
 *   - Agent in DB with enabled=true → included
 *   - Agent in DB with enabled=false → EXCLUDED even if in env
 *   - Agent in env allowlist with no DB row → included
 */
export async function listEnabledAgentIdsFromDb(): Promise<string[]> {
  const env = parseDripEnabledAgentIds(process.env.SPHERE_DRIP_ENABLED_AGENT_IDS);

  const { data, error } = await supabaseAdmin
    .from("agent_sphere_drip_prefs")
    .select("agent_id, enabled");
  if (error) {
    console.warn("[sphere-drip-prefs] listEnabled query failed:", error.message);
    // Fail-safe: if DB query errors, fall back to env so existing pilot
    // doesn't silently stop running.
    return env;
  }

  const dbRows = (data ?? []) as Array<{
    agent_id: string | number;
    enabled: boolean | null;
  }>;

  const explicit = new Map<string, boolean>();
  for (const r of dbRows) {
    explicit.set(String(r.agent_id), Boolean(r.enabled));
  }

  const result = new Set<string>();
  // Start with DB-enabled.
  for (const [id, on] of explicit) {
    if (on) result.add(id);
  }
  // Add env-allowlisted that aren't DB-disabled.
  for (const id of env) {
    if (explicit.get(id) === false) continue; // explicit opt-out wins
    result.add(id);
  }

  return Array.from(result);
}

/**
 * Settings-panel side: full effective state for one agent. Uses
 * supabaseServer (RLS-scoped) so the read is gated on agent ownership.
 */
export async function getEffectiveForAgent(
  agentId: string,
): Promise<EffectiveAgentDripPrefs> {
  const env = parseDripEnabledAgentIds(process.env.SPHERE_DRIP_ENABLED_AGENT_IDS);

  const { data, error } = await supabaseServer
    .from("agent_sphere_drip_prefs")
    .select("enabled, notes, updated_at")
    .eq("agent_id", agentId)
    .maybeSingle();

  if (error) {
    console.warn("[sphere-drip-prefs] getEffectiveForAgent failed:", error.message);
    // Soft-fail: treat as no row so the form still renders.
    const resolution = resolveDripEnabled({
      dbEnabled: undefined,
      envAllowlist: env,
      agentId,
    });
    return {
      agentId,
      enabled: resolution.enabled,
      notes: null,
      updatedAt: null,
      ...resolution,
    };
  }

  const row = data as {
    enabled: boolean | null;
    notes: string | null;
    updated_at: string | null;
  } | null;

  const dbEnabled = row ? Boolean(row.enabled) : undefined;
  const resolution = resolveDripEnabled({
    dbEnabled,
    envAllowlist: env,
    agentId,
  });

  return {
    agentId,
    enabled: resolution.enabled,
    notes: row?.notes ?? null,
    updatedAt: row?.updated_at ?? null,
    ...resolution,
  };
}

/**
 * Upsert the agent's prefs row. RLS-scoped via supabaseServer so the
 * caller can only write to their own row even if they pass a different
 * agentId; the policy `agent_sphere_drip_prefs_insert_own` will reject.
 */
export async function upsertPrefsForAgent(input: {
  agentId: string;
  enabled: boolean;
  notes: string | null;
}): Promise<AgentDripPrefs> {
  const payload = {
    agent_id: input.agentId,
    enabled: input.enabled,
    notes: input.notes,
  };

  const { data, error } = await supabaseServer
    .from("agent_sphere_drip_prefs")
    .upsert(payload, { onConflict: "agent_id" })
    .select("agent_id, enabled, notes, updated_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to save sphere-drip preferences");
  }

  const row = data as {
    agent_id: string | number;
    enabled: boolean | null;
    notes: string | null;
    updated_at: string | null;
  };

  return {
    agentId: String(row.agent_id),
    enabled: Boolean(row.enabled),
    notes: row.notes,
    updatedAt: row.updated_at,
  };
}
