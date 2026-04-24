import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { supabaseServer } from "@/lib/supabaseServer";
import { GMAIL_PROVIDER } from "@/lib/gmail-sync/config";

/**
 * POST /api/auth/google-gmail/disconnect
 *   Revokes the Gmail token at Google + deletes the row. Synced
 *   email_messages are KEPT — they're the agent's CRM history,
 *   nothing to do with the live OAuth grant. Only the sync
 *   subscription is torn down.
 */
export async function POST() {
  try {
    const { agentId } = await getCurrentAgentContext();

    const { data: tokenRow } = await supabaseServer
      .from("agent_oauth_tokens")
      .select("access_token, refresh_token")
      .eq("agent_id", agentId)
      .eq("provider", GMAIL_PROVIDER)
      .maybeSingle();

    const row = tokenRow as {
      access_token: string | null;
      refresh_token: string | null;
    } | null;

    // Revoke at Google — best-effort. Prefer revoking the refresh
    // token (cascades) if we have it, otherwise access token.
    const tokenToRevoke = row?.refresh_token ?? row?.access_token;
    if (tokenToRevoke) {
      void fetch(
        `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tokenToRevoke)}`,
        { method: "POST" },
      ).catch(() => {});
    }

    await supabaseServer
      .from("agent_oauth_tokens")
      .delete()
      .eq("agent_id", agentId)
      .eq("provider", GMAIL_PROVIDER);

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
