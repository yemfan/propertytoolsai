import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { GMAIL_PROVIDER, isGmailSyncConfigured } from "@/lib/gmail-sync/config";

export const runtime = "nodejs";

/**
 * GET /api/dashboard/integrations/gmail-status
 *   Lightweight status for the Settings UI. Returns:
 *     - connected: whether the agent has a valid OAuth row
 *     - accountEmail: the connected gmail address
 *     - lastSyncedAt / lastError
 *     - messagesSynced: running total of messages logged
 *     - configured: whether the server has the OAuth creds at all
 *       (so the UI can grey-out the button when env is missing)
 */
export async function GET() {
  try {
    const { agentId } = await getCurrentAgentContext();
    const configured = isGmailSyncConfigured();

    const { data } = await supabaseAdmin
      .from("agent_oauth_tokens")
      .select(
        "gmail_account_email, gmail_last_synced_at, gmail_last_sync_error, gmail_sync_enabled, gmail_messages_synced, connected_at",
      )
      .eq("agent_id", agentId)
      .eq("provider", GMAIL_PROVIDER)
      .maybeSingle();

    const row = data as {
      gmail_account_email: string | null;
      gmail_last_synced_at: string | null;
      gmail_last_sync_error: string | null;
      gmail_sync_enabled: boolean;
      gmail_messages_synced: number | null;
      connected_at: string | null;
    } | null;

    return NextResponse.json({
      ok: true,
      configured,
      connected: Boolean(row),
      accountEmail: row?.gmail_account_email ?? null,
      connectedAt: row?.connected_at ?? null,
      lastSyncedAt: row?.gmail_last_synced_at ?? null,
      lastError: row?.gmail_last_sync_error ?? null,
      syncEnabled: row?.gmail_sync_enabled ?? false,
      messagesSynced: row?.gmail_messages_synced ?? 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
