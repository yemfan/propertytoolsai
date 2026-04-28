/**
 * Pure roster builder for the listing-leads admin view.
 *
 * Combines three sources into one roster array:
 *   1. DB routing rules (agent_lead_routing) — primary source
 *   2. Env allowlist (IDX_ROUND_ROBIN_AGENT_IDS) — fallback when no DB
 *      rows exist OR overlay when both are configured
 *   3. Per-agent metadata (display name, last assignment, recent count)
 *
 * The output is a flat array sorted by recent assignment activity desc,
 * then by name asc — matches what an admin scanning the page wants to
 * see ("who's getting leads, who's idle"). Lives in its own file (no
 * `server-only`) so the math + dedup logic is testable directly.
 */

export type RosterAgentMeta = {
  agentId: string;
  /** Concatenation of agents.first_name + last_name. Falls back to the
   *  agent id when a name isn't on file. */
  displayName: string | null;
};

export type RosterRuleInput = {
  agentId: string;
  inRoundRobin: boolean;
  zipCoverage: ReadonlyArray<string>;
  priority: number;
  /** updated_at on the agent_lead_routing row. Null when the row is
   *  brand-new and the trigger hasn't stamped it yet. */
  rulesUpdatedAt: string | null;
};

export type RosterAssignmentInput = {
  agentId: string;
  /** Most recent contacts.created_at where source='idx_homes_for_sale'. */
  lastAssignmentAt: string | null;
  /** Count of IDX leads assigned to this agent in the last 30 days. */
  assignmentCountLast30Days: number;
};

export type RosterSource = "db" | "env" | "both";

export type RosterItem = {
  agentId: string;
  displayName: string | null;
  source: RosterSource;
  inRoundRobin: boolean;
  zipCoverage: string[];
  priority: number;
  lastAssignmentAt: string | null;
  assignmentCountLast30Days: number;
  rulesUpdatedAt: string | null;
};

export type BuildRosterInput = {
  /** All rows from agent_lead_routing — including those where
   *  in_round_robin = false. They show up disabled. */
  rules: ReadonlyArray<RosterRuleInput>;
  envAllowlist: ReadonlyArray<string>;
  /** Coverage from the env JSON, mapping agentId → ZIPs. Used when an
   *  env-only agent has no DB row. */
  envZipCoverage: ReadonlyMap<string, ReadonlyArray<string>>;
  agentMeta: ReadonlyArray<RosterAgentMeta>;
  assignments: ReadonlyArray<RosterAssignmentInput>;
};

export function buildLeadRoutingRoster(input: BuildRosterInput): RosterItem[] {
  const metaById = new Map<string, RosterAgentMeta>();
  for (const m of input.agentMeta) metaById.set(m.agentId, m);

  const assignmentByAgent = new Map<string, RosterAssignmentInput>();
  for (const a of input.assignments) assignmentByAgent.set(a.agentId, a);

  // Index env coverage as Set for cheaper lookups + dedup.
  const envCoverage = new Map<string, ReadonlyArray<string>>();
  for (const [k, v] of input.envZipCoverage) envCoverage.set(k, v);

  const envAllowlistSet = new Set(input.envAllowlist);

  // Step 1: every DB rule row produces a roster item.
  const items = new Map<string, RosterItem>();
  for (const rule of input.rules) {
    const agentId = rule.agentId;
    const meta = metaById.get(agentId);
    const assignment = assignmentByAgent.get(agentId);
    const inEnv = envAllowlistSet.has(agentId);
    items.set(agentId, {
      agentId,
      displayName: meta?.displayName ?? null,
      source: inEnv ? "both" : "db",
      inRoundRobin: rule.inRoundRobin,
      zipCoverage: dedupSorted(rule.zipCoverage),
      priority: rule.priority,
      lastAssignmentAt: assignment?.lastAssignmentAt ?? null,
      assignmentCountLast30Days: assignment?.assignmentCountLast30Days ?? 0,
      rulesUpdatedAt: rule.rulesUpdatedAt,
    });
  }

  // Step 2: env-only agents (in allowlist but no DB row).
  for (const agentId of input.envAllowlist) {
    if (items.has(agentId)) continue;
    const meta = metaById.get(agentId);
    const assignment = assignmentByAgent.get(agentId);
    const envZips = envCoverage.get(agentId) ?? [];
    items.set(agentId, {
      agentId,
      displayName: meta?.displayName ?? null,
      source: "env",
      // Env allowlist semantics: presence in the env list = enrolled.
      inRoundRobin: true,
      zipCoverage: dedupSorted(envZips),
      priority: 0,
      lastAssignmentAt: assignment?.lastAssignmentAt ?? null,
      assignmentCountLast30Days: assignment?.assignmentCountLast30Days ?? 0,
      rulesUpdatedAt: null,
    });
  }

  // Step 3: sort. Recent activity desc → name asc → id asc.
  return [...items.values()].sort((a, b) => {
    if (b.assignmentCountLast30Days !== a.assignmentCountLast30Days) {
      return b.assignmentCountLast30Days - a.assignmentCountLast30Days;
    }
    const aLast = a.lastAssignmentAt ?? "";
    const bLast = b.lastAssignmentAt ?? "";
    if (aLast !== bLast) return aLast > bLast ? -1 : 1; // desc
    const aName = (a.displayName ?? a.agentId).toLowerCase();
    const bName = (b.displayName ?? b.agentId).toLowerCase();
    if (aName !== bName) return aName < bName ? -1 : 1;
    return a.agentId < b.agentId ? -1 : 1;
  });
}

function dedupSorted(zips: ReadonlyArray<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const z of zips) {
    if (typeof z !== "string") continue;
    const trimmed = z.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  out.sort();
  return out;
}

/**
 * Build a flat ZIP-coverage map for the admin page's "ZIP coverage"
 * tab — `zip → agentId[]` so the agent can see which ZIPs are covered
 * (and by whom) at a glance.
 */
export function buildZipCoverageMap(
  roster: ReadonlyArray<RosterItem>,
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const item of roster) {
    if (!item.inRoundRobin) continue;
    for (const zip of item.zipCoverage) {
      const list = map.get(zip);
      if (list) list.push(item.agentId);
      else map.set(zip, [item.agentId]);
    }
  }
  // Sort agent ids within each zip for stable rendering.
  for (const list of map.values()) list.sort();
  return map;
}
