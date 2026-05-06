import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Best-effort lookup of a CRM contact by the inbound email's `from`
 * header.
 *
 * Phase 2B-1 — *suggestion only*. We don't auto-attribute the email
 * to this contact; the review page renders it as a "Looks like Jane
 * Doe — yes / different person" toggle. This is intentional:
 *
 *   * Forwarded offers commonly arrive `From:` a transaction
 *     coordinator, an assistant, or a buyer's-agent partner. The
 *     real party is often elsewhere on the To/Cc lines.
 *   * Auto-routing on a wrong guess would poison the CRM (offers
 *     attached to the wrong contact, downstream tasks mis-fired).
 *
 * Match rules:
 *   1. Extract the email address out of an "RFC 5322"-ish `from`
 *      header — accepts both bare addresses and `"Name" <addr>`.
 *   2. Lowercase + trim before lookup; the contacts.email column is
 *      stored as the agent typed it, so we compare case-insensitively
 *      via `ilike`.
 *   3. Scope to the routed agent's contacts only. Cross-agent
 *      matches are explicitly out of scope — agents shouldn't see
 *      each other's CRM data.
 */

export type ContactMatch = {
  id: string;
  name: string | null;
  email: string;
};

/**
 * Pull the bare email address out of a `from`-style header. Returns
 * null when nothing email-shaped is present. Exported for unit-test
 * coverage and so the webhook can call it without hitting the DB if
 * it just needs the parsed address.
 */
export function extractEmailAddress(header: string | null | undefined): string | null {
  if (!header) return null;
  // Prefer the `<addr>` portion when present (Gmail-style display
  // names); fall back to the whole string otherwise.
  const angleMatch = header.match(/<\s*([^>]+?)\s*>/);
  const candidate = (angleMatch ? angleMatch[1] : header).trim();
  // Loose RFC 5322 — good enough for matching real-world addresses
  // without tripping over edge cases (quoted locals, plus-tags, etc.).
  const emailMatch = candidate.match(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/);
  return emailMatch ? emailMatch[0].toLowerCase() : null;
}

/**
 * Look up a contact by email for the routed agent. Returns the first
 * exact-email match (case-insensitive). When multiple contacts share
 * an email — rare but possible if the agent imported overlapping
 * lists — we take the most recently created one, on the theory that
 * newer is more likely the active record.
 */
export async function findContactByEmailForAgent(
  agentId: string,
  email: string,
): Promise<ContactMatch | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const { data, error } = await supabaseAdmin
    .from("contacts")
    .select("id, name, first_name, last_name, email")
    .eq("agent_id", agentId as any)
    .ilike("email", normalized)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    // Don't throw — a failed contact lookup is non-fatal for the
    // webhook. Worst case the review page shows "no match" and the
    // agent picks manually.
    console.warn("[inbound] contact match lookup failed:", error.message);
    return null;
  }
  if (!data) return null;

  type ContactRow = {
    id: string;
    name: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  };
  const row = data as ContactRow;
  const fullName =
    (row.first_name || row.last_name
      ? `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim()
      : row.name) ?? null;

  return {
    id: row.id,
    name: fullName || null,
    email: row.email ?? normalized,
  };
}

/**
 * Convenience wrapper used by the webhook: parse `from`, look up
 * contact, return null if either step fails. Never throws.
 */
export async function matchSenderToContact(
  agentId: string,
  fromHeader: string | null | undefined,
): Promise<ContactMatch | null> {
  const email = extractEmailAddress(fromHeader);
  if (!email) return null;
  return findContactByEmailForAgent(agentId, email);
}
