import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cronAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { runGmailSyncForAgent } from "@/lib/gmail-sync/sync";
import { GMAIL_PROVIDER } from "@/lib/gmail-sync/config";

export const runtime = "nodejs";
// Syncing N agents serially with Gmail API round-trips can take a
// while — 50 agents × ~3s each = 150s. Give ourselves headroom.
export const maxDuration = 300;

/**
 * GET /api/cron/gmail-sync
 *   Iterates every connected agent with gmail_sync_enabled=true and
 *   runs the per-agent sync. Suggested schedule: every 5 minutes.
 *
 *   Query params (optional):
 *     ?agentId=XYZ  — limit to one agent (handy for manual tests)
 *     ?limit=N      — cap the number of agents per run
 *
 *   Verified via CRON_SECRET — same mechanism every other cron uses.
 */
export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const onlyAgent = url.searchParams.get("agentId");
  const limit = Math.min(
    200,
    Math.max(1, Number(url.searchParams.get("limit")) || 50),
  );

  // Pull the agent_ids that need syncing. We prioritize agents that
  // haven't been synced recently (oldest first) to keep fresh data
  // flowing even when the connected-agent count exceeds one run's
  // capacity.
  let q = supabaseAdmin
    .from("agent_oauth_tokens")
    .select("agent_id, gmail_last_synced_at")
    .eq("provider", GMAIL_PROVIDER)
    .eq("gmail_sync_enabled", true)
    .order("gmail_last_synced_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  if (onlyAgent) q = q.eq("agent_id", onlyAgent);

  const { data: rows, error } = await q;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const tokens = (rows ?? []) as Array<{
    agent_id: string;
    gmail_last_synced_at: string | null;
  }>;

  const results = [];
  let totalLogged = 0;
  let totalErrors = 0;
  for (const t of tokens) {
    try {
      const r = await runGmailSyncForAgent(t.agent_id);
      results.push(r);
      totalLogged += r.logged;
      if (r.status === "error") totalErrors += 1;
    } catch (err) {
      totalErrors += 1;
      results.push({
        agentId: t.agent_id,
        status: "error" as const,
        reason: err instanceof Error ? err.message : "unknown",
        fetched: 0,
        logged: 0,
        skippedUnmatched: 0,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    processed: tokens.length,
    totalLogged,
    totalErrors,
    results,
  });
}
