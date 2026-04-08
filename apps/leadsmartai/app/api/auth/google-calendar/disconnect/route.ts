import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST() {
  try {
    const { agentId } = await getCurrentAgentContext();

    // Revoke token at Google (best-effort)
    const { data: tokenRow } = await supabaseServer
      .from("agent_oauth_tokens")
      .select("access_token")
      .eq("agent_id", agentId as any)
      .eq("provider", "google")
      .maybeSingle();

    if ((tokenRow as any)?.access_token) {
      fetch(`https://oauth2.googleapis.com/revoke?token=${(tokenRow as any).access_token}`, {
        method: "POST",
      }).catch(() => {});
    }

    // Delete from DB
    await supabaseServer
      .from("agent_oauth_tokens")
      .delete()
      .eq("agent_id", agentId as any)
      .eq("provider", "google");

    // Clear external_event_id on events (they're now orphaned)
    await supabaseServer
      .from("lead_calendar_events")
      .update({ external_event_id: null, calendar_provider: null } as any)
      .eq("agent_id", agentId as any)
      .eq("calendar_provider", "google");

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
