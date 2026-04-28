/**
 * Pure resolver for the effective sphere-drip enrollment state of an
 * agent. Lives in its own file (no `server-only`) so vitest hits the
 * branching directly.
 *
 * Resolution order — same pattern as PR #165 lead-routing:
 *   1. DB row exists → respect its `enabled` value (true OR false).
 *      If the agent has explicitly disabled, env doesn't override that.
 *   2. No DB row → check env allowlist; presence in list = enabled.
 *   3. Neither → disabled (the safe default).
 *
 * Why DB-disabled wins over env-enabled: agents may explicitly opt
 * out via the settings UI even after being added to the env list.
 * Honoring their explicit "off" is more important than honoring an
 * implicit env "on" — otherwise the toggle they just clicked has no
 * visible effect.
 */

export type DripEnabledSource = "db" | "env" | "default";

export type DripEnabledResolution = {
  enabled: boolean;
  source: DripEnabledSource;
  /** True when there's a row in agent_sphere_drip_prefs (regardless of
   *  the row's enabled value). Used by the settings panel to render
   *  "saved" vs. "never configured" hints. */
  hasDbRow: boolean;
  /** True when the env allowlist also lists this agent. Helps the UI
   *  surface the back-compat overlap honestly ("DB is on AND env lists
   *  you" vs. "only env lists you"). */
  inEnvAllowlist: boolean;
};

export function resolveDripEnabled(args: {
  /** undefined when no row exists; true/false when one does. */
  dbEnabled: boolean | undefined;
  /** Trimmed, deduped allowlist parsed from
   *  SPHERE_DRIP_ENABLED_AGENT_IDS — pass [] when the env is unset. */
  envAllowlist: ReadonlyArray<string>;
  agentId: string;
}): DripEnabledResolution {
  const inEnv = args.envAllowlist.includes(args.agentId);

  if (typeof args.dbEnabled === "boolean") {
    return {
      enabled: args.dbEnabled,
      source: "db",
      hasDbRow: true,
      inEnvAllowlist: inEnv,
    };
  }

  if (inEnv) {
    return {
      enabled: true,
      source: "env",
      hasDbRow: false,
      inEnvAllowlist: true,
    };
  }

  return {
    enabled: false,
    source: "default",
    hasDbRow: false,
    inEnvAllowlist: false,
  };
}

/**
 * Parse the env allowlist string into a normalized array. Mirrors the
 * helper in lib/sphereDrip/runEnrollments.ts so callers (settings UI
 * service, cron runner) agree on what "in the env list" means.
 */
export function parseDripEnabledAgentIds(raw: string | null | undefined): string[] {
  if (!raw || typeof raw !== "string") return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}
