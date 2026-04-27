/**
 * Per-agent cadence resolver for the SOI seller-prediction digest cron.
 *
 * Default cadence is `daily` (every cron run sends a digest). Two env-var
 * allowlists override per-agent:
 *
 *   - `SPHERE_DIGEST_WEEKLY_AGENT_IDS` — comma-separated. Listed agents
 *     only receive the digest on Mondays (UTC). Useful for power-users
 *     who don't want their morning SMS interrupted unless something is
 *     genuinely high-priority.
 *
 *   - `SPHERE_DIGEST_OFF_AGENT_IDS` — comma-separated. Listed agents
 *     never receive the digest. Useful for agents who only want pull-
 *     mode (the dashboard surface) without push.
 *
 * Precedence: off > weekly > daily. An agent in BOTH the weekly and off
 * lists is treated as off (the more conservative choice).
 *
 * Pure — no I/O, no `Date.now()`. The orchestrator passes `now` so this
 * is fully testable. Lives in its own file (no `server-only`) so vitest
 * can hit it without the shim.
 */

export type DigestCadence = "daily" | "weekly" | "off";

export type DigestCadenceEnv = {
  SPHERE_DIGEST_WEEKLY_AGENT_IDS?: string;
  SPHERE_DIGEST_OFF_AGENT_IDS?: string;
};

/** Parse a comma-separated env value into a Set of trimmed non-empty ids. */
export function parseAgentIdSet(raw: string | null | undefined): Set<string> {
  const out = new Set<string>();
  if (!raw || typeof raw !== "string") return out;
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (trimmed) out.add(trimmed);
  }
  return out;
}

/**
 * Resolve the cadence for a specific agent given the env allowlists.
 * Precedence: off > weekly > daily.
 */
export function getCadenceForAgent(
  agentId: string,
  env: DigestCadenceEnv,
): DigestCadence {
  const offSet = parseAgentIdSet(env.SPHERE_DIGEST_OFF_AGENT_IDS);
  if (offSet.has(agentId)) return "off";
  const weeklySet = parseAgentIdSet(env.SPHERE_DIGEST_WEEKLY_AGENT_IDS);
  if (weeklySet.has(agentId)) return "weekly";
  return "daily";
}

/**
 * Should the cron actually send today's digest for this agent?
 *
 * Day-of-week is evaluated in UTC against the cron's invocation time —
 * matches how Vercel Cron schedules. Weekly agents get the digest on
 * UTC Monday (day 1). The cron itself runs daily at 14:00 UTC; the
 * orchestrator delegates here per-agent.
 */
export function shouldRunDigestForAgentToday(
  agentId: string,
  env: DigestCadenceEnv,
  now: Date,
): boolean {
  const cadence = getCadenceForAgent(agentId, env);
  if (cadence === "off") return false;
  if (cadence === "daily") return true;
  // weekly → Monday only (UTC, getUTCDay returns 1 for Monday)
  return now.getUTCDay() === 1;
}
