import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { getFreshGmailAccessToken } from "./tokenRefresh";
import { GMAIL_PROVIDER } from "./config";

/**
 * Per-agent Gmail sync runner.
 *
 * First run (no history_id yet):
 *   Bootstrap with `messages.list?q=newer_than:7d`. We don't want
 *   to backfill the agent's entire inbox — just the last week so
 *   the feature feels live on connect.
 *
 * Subsequent runs:
 *   Use `history.list?startHistoryId=X` which returns only the
 *   deltas since our last sync. Much cheaper and respects Gmail's
 *   rate limits.
 *
 * Matching:
 *   For each message, extract From / To / Cc addresses. If any
 *   address matches a `leads.email` belonging to this agent, log
 *   the message to `email_messages` with direction='inbound' or
 *   'outbound' (outbound = message whose From === the connected
 *   account). Unmatched messages are ignored — no need to store
 *   conversations the CRM doesn't care about.
 *
 * Idempotency:
 *   email_messages has a unique index on (agent_id, external_message_id)
 *   so retries / overlapping cron runs can't double-insert.
 */

export type GmailSyncResult = {
  agentId: string;
  status: "ok" | "skipped" | "error";
  reason?: string;
  newHistoryId?: string;
  fetched: number;
  logged: number;
  skippedUnmatched: number;
};

type GmailMessage = {
  id: string;
  threadId: string;
  historyId?: string;
  internalDate?: string;
  snippet?: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
  };
};

const MAX_MESSAGES_PER_RUN = 200;

export async function runGmailSyncForAgent(
  agentId: string,
): Promise<GmailSyncResult> {
  const tok = await getFreshGmailAccessToken(agentId);
  if (!tok) {
    return {
      agentId,
      status: "skipped",
      reason: "not connected / token invalid",
      fetched: 0,
      logged: 0,
      skippedUnmatched: 0,
    };
  }

  // Load current cursor from DB.
  const { data: stateRow } = await supabaseAdmin
    .from("agent_oauth_tokens")
    .select("gmail_history_id, gmail_messages_synced")
    .eq("agent_id", agentId)
    .eq("provider", GMAIL_PROVIDER)
    .maybeSingle();
  const state = stateRow as {
    gmail_history_id: string | null;
    gmail_messages_synced: number | null;
  } | null;
  const priorHistoryId = state?.gmail_history_id ?? null;

  let messageIds: string[] = [];
  let newHistoryId: string | null = null;

  try {
    if (priorHistoryId) {
      // ── Incremental sync via history.list ──────────────────────
      const { ids, historyId } = await fetchHistoryMessageIds(
        tok.accessToken,
        priorHistoryId,
      );
      messageIds = ids;
      newHistoryId = historyId;
    } else {
      // ── First run: bootstrap last 7 days only ─────────────────
      const { ids, historyId } = await fetchRecentMessageIds(tok.accessToken);
      messageIds = ids;
      newHistoryId = historyId;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    await stampSyncError(agentId, message);
    return {
      agentId,
      status: "error",
      reason: message,
      fetched: 0,
      logged: 0,
      skippedUnmatched: 0,
    };
  }

  // Load the lead address book once per run so we don't N+1 the DB.
  const agentLeads = await loadAgentLeadEmails(agentId);
  const accountEmailLower = (tok.accountEmail ?? "").toLowerCase();

  let logged = 0;
  let skippedUnmatched = 0;

  // Fetch message bodies in parallel — Gmail allows ~200 req/sec,
  // we batch at 10 to stay well under.
  const toFetch = messageIds.slice(0, MAX_MESSAGES_PER_RUN);
  for (let i = 0; i < toFetch.length; i += 10) {
    const batch = toFetch.slice(i, i + 10);
    const results = await Promise.allSettled(
      batch.map((id) => fetchMessage(tok.accessToken, id)),
    );
    for (const r of results) {
      if (r.status !== "fulfilled" || !r.value) continue;
      const msg = r.value;
      const inserted = await logMessageIfMatched({
        agentId,
        message: msg,
        agentLeads,
        accountEmailLower,
      });
      if (inserted === "logged") logged += 1;
      else if (inserted === "skipped") skippedUnmatched += 1;
      // 'duplicate' → silent no-op
    }
  }

  // Advance cursor + stamp last-synced.
  await supabaseAdmin
    .from("agent_oauth_tokens")
    .update({
      gmail_history_id: newHistoryId ?? priorHistoryId,
      gmail_last_synced_at: new Date().toISOString(),
      gmail_last_sync_error: null,
      gmail_messages_synced: (state?.gmail_messages_synced ?? 0) + logged,
      updated_at: new Date().toISOString(),
    })
    .eq("agent_id", agentId)
    .eq("provider", GMAIL_PROVIDER);

  return {
    agentId,
    status: "ok",
    newHistoryId: newHistoryId ?? undefined,
    fetched: toFetch.length,
    logged,
    skippedUnmatched,
  };
}

// ── Gmail API helpers ─────────────────────────────────────────────

async function fetchRecentMessageIds(
  accessToken: string,
): Promise<{ ids: string[]; historyId: string | null }> {
  const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  url.searchParams.set("q", "newer_than:7d");
  url.searchParams.set("maxResults", String(MAX_MESSAGES_PER_RUN));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`messages.list failed: ${res.status}`);
  const data = (await res.json()) as {
    messages?: Array<{ id: string; threadId: string }>;
    resultSizeEstimate?: number;
  };
  const ids = (data.messages ?? []).map((m) => m.id);
  // Bootstrap historyId: fetch profile to get the current maximum.
  let historyId: string | null = null;
  try {
    const profRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (profRes.ok) {
      const p = (await profRes.json()) as { historyId?: string };
      historyId = p.historyId ?? null;
    }
  } catch {
    /* best-effort */
  }
  return { ids, historyId };
}

async function fetchHistoryMessageIds(
  accessToken: string,
  startHistoryId: string,
): Promise<{ ids: string[]; historyId: string | null }> {
  const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/history");
  url.searchParams.set("startHistoryId", startHistoryId);
  url.searchParams.set("historyTypes", "messageAdded");
  url.searchParams.set("maxResults", String(MAX_MESSAGES_PER_RUN));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 404) {
    // History id too old (>7d). Fall back to a recent-messages
    // re-bootstrap so the agent doesn't stay stuck.
    return fetchRecentMessageIds(accessToken);
  }
  if (!res.ok) throw new Error(`history.list failed: ${res.status}`);
  const data = (await res.json()) as {
    history?: Array<{ messagesAdded?: Array<{ message: { id: string } }> }>;
    historyId?: string;
  };
  const ids: string[] = [];
  for (const entry of data.history ?? []) {
    for (const added of entry.messagesAdded ?? []) {
      if (added.message?.id) ids.push(added.message.id);
    }
  }
  return {
    ids: Array.from(new Set(ids)),
    historyId: data.historyId ?? startHistoryId,
  };
}

async function fetchMessage(
  accessToken: string,
  id: string,
): Promise<GmailMessage | null> {
  // format=metadata gives us headers + snippet without body noise.
  // For a full CRM log we want the plaintext body → use `full` and
  // extract below. The size cost is fine at our scale.
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as GmailMessage & {
    payload?: {
      headers?: Array<{ name: string; value: string }>;
      parts?: Array<{ mimeType?: string; body?: { data?: string }; parts?: unknown[] }>;
      body?: { data?: string };
    };
  };
  return data;
}

// ── Matching + persisting ────────────────────────────────────────

async function loadAgentLeadEmails(
  agentId: string,
): Promise<Map<string, string>> {
  const { data } = await supabaseAdmin
    .from("leads")
    .select("id, email")
    .eq("agent_id", agentId)
    .not("email", "is", null);
  const map = new Map<string, string>();
  for (const row of (data ?? []) as Array<{ id: string; email: string | null }>) {
    if (row.email) map.set(row.email.trim().toLowerCase(), row.id);
  }
  return map;
}

async function logMessageIfMatched(opts: {
  agentId: string;
  message: GmailMessage & {
    payload?: {
      headers?: Array<{ name: string; value: string }>;
      parts?: Array<{ mimeType?: string; body?: { data?: string } }>;
      body?: { data?: string };
    };
  };
  agentLeads: Map<string, string>;
  accountEmailLower: string;
}): Promise<"logged" | "skipped" | "duplicate" | "error"> {
  const { agentId, message, agentLeads, accountEmailLower } = opts;
  const headers = message.payload?.headers ?? [];
  const H = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

  const fromAddr = extractEmail(H("From"));
  const toAddrs = extractEmails(H("To"));
  const ccAddrs = extractEmails(H("Cc"));

  // Find a contact match among all counterparties.
  let matchedLeadId: string | null = null;
  for (const addr of [fromAddr, ...toAddrs, ...ccAddrs]) {
    if (!addr) continue;
    const leadId = agentLeads.get(addr);
    if (leadId) {
      matchedLeadId = leadId;
      break;
    }
  }
  if (!matchedLeadId) return "skipped";

  // Direction = outbound if sender is the connected account, else inbound.
  const direction =
    fromAddr && accountEmailLower && fromAddr === accountEmailLower
      ? "outbound"
      : "inbound";
  const subject = H("Subject") || "(no subject)";
  const body = extractPlainBody(message.payload) || message.snippet || "";

  const { error } = await supabaseAdmin.from("email_messages").insert({
    agent_id: agentId,
    lead_id: matchedLeadId,
    subject,
    message: body.slice(0, 20000), // guard — DB has no length cap but no need to store huge threads in full
    direction,
    external_message_id: message.id,
  });
  if (error) {
    if ((error as { code?: string }).code === "23505") return "duplicate";
    console.warn("[gmail-sync] insert failed:", error.message);
    return "error";
  }
  return "logged";
}

function extractEmail(s: string): string {
  if (!s) return "";
  const m = /<([^>]+)>/.exec(s);
  const candidate = (m ? m[1] : s).trim().toLowerCase();
  return candidate.includes("@") ? candidate : "";
}

function extractEmails(s: string): string[] {
  if (!s) return [];
  return s
    .split(",")
    .map((x) => extractEmail(x))
    .filter(Boolean);
}

function extractPlainBody(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  type Part = {
    mimeType?: string;
    body?: { data?: string };
    parts?: Part[];
  };
  const stack: Part[] = [payload as Part];
  while (stack.length) {
    const p = stack.pop()!;
    if (p.mimeType === "text/plain" && p.body?.data) {
      return decodeBase64Url(p.body.data);
    }
    if (p.parts?.length) stack.push(...p.parts);
  }
  // Fallback: any text/html, strip tags.
  const stack2: Part[] = [payload as Part];
  while (stack2.length) {
    const p = stack2.pop()!;
    if (p.mimeType === "text/html" && p.body?.data) {
      return stripHtml(decodeBase64Url(p.body.data));
    }
    if (p.parts?.length) stack2.push(...p.parts);
  }
  return "";
}

function decodeBase64Url(s: string): string {
  try {
    // Gmail uses base64url encoding; convert to standard base64 first.
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(b64, "base64").toString("utf8");
  } catch {
    return "";
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function stampSyncError(agentId: string, message: string): Promise<void> {
  await supabaseAdmin
    .from("agent_oauth_tokens")
    .update({
      gmail_last_sync_error: message.slice(0, 300),
      gmail_last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("agent_id", agentId)
    .eq("provider", GMAIL_PROVIDER);
}
