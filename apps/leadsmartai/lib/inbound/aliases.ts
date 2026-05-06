import "server-only";
import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Inbound email alias management.
 *
 * Phase 1 (this file): one alias per agent, auto-created on first
 * /dashboard/calendar visit. The alias is a globally-unique local_part
 * shaped like `agent-<random6>` so it's hard to guess (mild abuse
 * deterrent — the real protection is INBOUND_PARSE_SECRET on the
 * webhook).
 *
 * Future (not here): multiple aliases per agent, regenerate-alias
 * action, per-alias intent filters.
 */

export type AgentInboundAlias = {
  id: string;
  agent_id: string;
  local_part: string;
  label: string | null;
  last_received_at: string | null;
  inbound_count: number;
};

/** Domain the inbound webhook listens on. Set in env once SendGrid is wired. */
export function getInboundDomain(): string {
  return process.env.INBOUND_EMAIL_DOMAIN?.trim() || "inbox.leadsmart-ai.com";
}

/** Compose the full forwarding address from an alias row. */
export function aliasToAddress(alias: Pick<AgentInboundAlias, "local_part">): string {
  return `${alias.local_part}@${getInboundDomain()}`;
}

/**
 * Generate a fresh local_part. Format: `agent-<6 lowercase alphanumeric>`.
 * Stays under the unique constraint check regex
 * `^[a-z0-9][a-z0-9-]{2,62}[a-z0-9]$`.
 */
function freshLocalPart(): string {
  const buf = randomBytes(4); // 8 hex chars; we'll trim to 6
  const slug = buf.toString("hex").slice(0, 6).toLowerCase();
  return `agent-${slug}`;
}

/**
 * Get the agent's alias, creating one if missing. First-call lazy
 * provisioning so existing agents start working without a backfill.
 *
 * Race: if two requests for the same agent fire simultaneously, the
 * unique constraint on (agent_id) — which we don't have, but
 * effectively one alias per agent — is enforced via "select first,
 * insert if missing". Two parallel inserts could create two aliases
 * for the same agent. Rare and harmless (we just return the first
 * one on the next read), so not worth a SELECT FOR UPDATE here.
 */
export async function ensureAgentAlias(agentId: string): Promise<AgentInboundAlias> {
  const { data: existing } = await supabaseAdmin
    .from("agent_inbound_aliases")
    .select("*")
    .eq("agent_id", agentId as any)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existing) return existing as AgentInboundAlias;

  // Try a few times in the unlikely event of a local_part collision —
  // 6 hex chars = 16M space, single-digit collision probability per
  // 1000 inserts, but we want to be defensive against the unique
  // constraint rejection.
  for (let attempt = 0; attempt < 5; attempt++) {
    const localPart = freshLocalPart();
    const { data, error } = await supabaseAdmin
      .from("agent_inbound_aliases")
      .insert({ agent_id: agentId as any, local_part: localPart } as any)
      .select()
      .maybeSingle();
    if (data) return data as AgentInboundAlias;
    if (error && !/unique/i.test(error.message)) {
      throw new Error(error.message);
    }
    // unique-violation → retry with a fresh local_part
  }
  throw new Error("Could not provision an inbound alias after 5 attempts");
}

/**
 * Webhook lookup — find the agent owning a given local_part. Returns
 * null when the local_part doesn't map to any alias (random POSTs
 * targeting `info@` etc. should be silently dropped).
 */
export async function findAgentByLocalPart(
  localPart: string,
): Promise<AgentInboundAlias | null> {
  const { data } = await supabaseAdmin
    .from("agent_inbound_aliases")
    .select("*")
    .eq("local_part", localPart.toLowerCase())
    .maybeSingle();
  return (data as AgentInboundAlias | null) ?? null;
}

/** Bump the inbound_count + last_received_at after a successful delivery. */
export async function recordInboundDelivery(aliasId: string): Promise<void> {
  // No atomic increment helper available — do a select-then-update so
  // the RPC isn't required. Concurrent deliveries to the same alias
  // are rare; a small race window where the count is off by one is
  // acceptable for this stat.
  const { data: row } = await supabaseAdmin
    .from("agent_inbound_aliases")
    .select("inbound_count")
    .eq("id", aliasId as any)
    .maybeSingle();
  const current = (row as { inbound_count: number } | null)?.inbound_count ?? 0;
  await supabaseAdmin
    .from("agent_inbound_aliases")
    .update({
      inbound_count: current + 1,
      last_received_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any)
    .eq("id", aliasId as any);
}
