import "server-only";

import { supabaseServer } from "@/lib/supabaseServer";

import {
  buildAssignmentMap,
  parseAgentAllowlist,
  pickNextAgent,
  type AgentLastAssignment,
} from "@/lib/leadAssignment/pickNextAgent";
import {
  filterAgentsByZip,
  parseAgentZipCoverage,
} from "@/lib/leadAssignment/zipCoverage";

/**
 * Round-robin (least-recently-assigned) IDX lead assignment.
 *
 * Resolution order, in priority:
 *   1. `IDX_ROUND_ROBIN_AGENT_IDS` (comma-separated) — pilot allowlist.
 *      The picker rotates across these agents using `contacts.created_at`
 *      timestamps as the per-agent last-assignment marker. No new schema.
 *   2. `IDX_DEMO_AGENT_ID` — single-agent fallback, preserves existing
 *      pre-round-robin behavior for solo-agent demos.
 *   3. null — lead is captured into the unassigned pool. The agent
 *     dashboard already has a "Hot leads / lead inbox" surface for
 *     unassigned rows (see AgentDashboardClient).
 *
 * ZIP-based filtering: when `IDX_AGENT_ZIP_COVERAGE` is set (JSON object
 * mapping agent ids to ZIP arrays) AND the caller supplies a `zip`, the
 * round-robin allowlist is narrowed to agents whose declared coverage
 * includes that ZIP. If no listed agent covers the ZIP, the picker falls
 * back to the full allowlist — preferring an imperfect-fit agent over
 * silently dropping the lead.
 *
 * Why derive last-assignment from `contacts` instead of an event row:
 *   - Self-correcting: if a lead is deleted or reassigned, the
 *     rotation immediately reflects reality.
 *   - One supabase query (group-by) instead of two (event read + write).
 *   - No new schema. The `contacts` row created downstream IS the record.
 *
 * Caveat: there's a TOCTOU window between the picker reading timestamps
 * and the lead-capture route inserting the new contact. With a small
 * pilot agent pool (3-10) and human-paced form submissions this is
 * effectively zero-risk; if we ever batch-import IDX leads we'll need a
 * SQL function or advisory lock to make this atomic.
 */

export const IDX_LEAD_SOURCE = "idx_homes_for_sale";

export type AssignNextAgentOptions = {
  /**
   * Optional 5-digit US ZIP for the lead. When provided AND
   * `IDX_AGENT_ZIP_COVERAGE` declares per-agent coverage, the round-robin
   * allowlist is narrowed to agents who service this ZIP. Falls back to
   * the full allowlist when no listed agent covers it.
   */
  zip?: string | null;
};

/**
 * Public API. Returns the assigned `agent_id`, or null if no assignment is
 * possible (empty allowlist + no fallback). Failures from the timestamp
 * query degrade to "pick first eligible by id ascending" rather than
 * leaving the lead unassigned — keeps the funnel flowing if Supabase has
 * a transient issue.
 */
export async function assignNextAgentForIdxLead(
  opts: AssignNextAgentOptions = {},
): Promise<string | null> {
  const allowlist = parseAgentAllowlist(process.env.IDX_ROUND_ROBIN_AGENT_IDS);

  // Path 1: round-robin across the allowlist (optionally narrowed by ZIP).
  if (allowlist.length > 0) {
    const coverage = parseAgentZipCoverage(process.env.IDX_AGENT_ZIP_COVERAGE);
    const filtered = filterAgentsByZip(allowlist, opts.zip ?? null, coverage);
    const map = await fetchLastAssignmentMap(filtered);
    return pickNextAgent(filtered, map);
  }

  // Path 2: single-agent fallback — original demo behavior.
  const demo = process.env.IDX_DEMO_AGENT_ID?.trim();
  if (demo) return demo;

  // Path 3: no assignment.
  return null;
}

/**
 * Query `contacts` for the most recent IDX-source assignment per agent in the
 * allowlist. Best-effort — on query failure returns an empty map (which the
 * picker treats as "all never-assigned" → picks first by id ascending).
 *
 * Group-by isn't a first-class Supabase JS-client operation, so we project
 * the rows we need and group in memory. With pilot-sized allowlists (≤10
 * agents) and the 90-day-ish row volume per agent, this stays cheap.
 */
async function fetchLastAssignmentMap(
  allowlist: ReadonlyArray<string>,
): Promise<Map<string, string>> {
  try {
    const { data, error } = await supabaseServer
      .from("contacts")
      .select("agent_id, created_at")
      .eq("source", IDX_LEAD_SOURCE)
      .in("agent_id", allowlist as string[])
      .order("created_at", { ascending: false })
      .limit(1000); // bounded — pilot will be far below this
    if (error) {
      console.warn("[lead-assignment] fetchLastAssignmentMap failed", error.message);
      return new Map();
    }
    const rows: AgentLastAssignment[] = (
      (data ?? []) as Array<{ agent_id: string | null; created_at: string }>
    )
      .filter((r) => r.agent_id != null)
      .map((r) => ({
        agentId: String(r.agent_id),
        lastAssignedAt: r.created_at,
      }));
    return buildAssignmentMap(rows);
  } catch (e) {
    console.warn("[lead-assignment] fetchLastAssignmentMap threw", e);
    return new Map();
  }
}
