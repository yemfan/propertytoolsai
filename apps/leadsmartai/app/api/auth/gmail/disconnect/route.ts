import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { supabaseServer } from "@/lib/supabaseServer";
import { GMAIL_PROVIDER_KEY } from "@/lib/gmail/config";

/**
 * POST /api/auth/gmail/disconnect
 *
 * Best-effort revokes the access token at Google so it stops working
 * immediately, then deletes the local row. We don't fail if the
 * Google revoke errors — the row deletion is what actually severs
 * our ability to call Gmail on the agent's behalf.
 */
export async function POST() {
  try {
    const { agentId } = await getCurrentAgentContext();

    const { data: tokenRow } = await supabaseServer
      .from("agent_oauth_tokens")
      .select("access_token")
      .eq("agent_id", agentId as any)
      .eq("provider", GMAIL_PROVIDER_KEY)
      .maybeSingle();

    const accessToken = (tokenRow as any)?.access_token;
    if (accessToken) {
      // Revoke at Google. Fire-and-forget.
      fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, {
        method: "POST",
      }).catch(() => {});
    }

    await supabaseServer
      .from("agent_oauth_tokens")
      .delete()
      .eq("agent_id", agentId as any)
      .eq("provider", GMAIL_PROVIDER_KEY);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
