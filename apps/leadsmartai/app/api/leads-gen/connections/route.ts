import { NextResponse } from "next/server";

import { getDashboardAgentContext } from "@/lib/contact-intake/dashboardAgentContext";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * GET /api/leads-gen/connections
 *
 * Returns the agent's social platform connections for use by the
 * Quick Post wizard. Tokens NOT included — this endpoint is safe
 * to call from the client. Just enough metadata to render the
 * "Publish to Facebook" / "Publish to Instagram" buttons (Page
 * name, IG handle, whether the connection is healthy).
 *
 * The full connection-management UI uses a separate server-rendered
 * page that does a service-role read directly — this endpoint
 * exists for the client-side wizard.
 */
export async function GET() {
  try {
    const auth = await getDashboardAgentContext();
    if (auth.ok === false) return auth.response;

    if (auth.planType === "free") {
      // Free plan can't have connected accounts, so return empty
      // rather than 402 — keeps the wizard render path simpler
      // (it just shows the compose-URL fallback when there are no
      // connections).
      return NextResponse.json({ ok: true, connections: [] });
    }

    const { data, error } = await supabaseAdmin
      .from("social_accounts")
      .select(
        "id, platform, fb_page_id, fb_page_name, ig_business_user_id, ig_business_username, account_picture_url, status",
      )
      .eq("agent_id", auth.agentId)
      .eq("status", "connected")
      .order("connected_at", { ascending: false });

    if (error) throw error;

    type Row = {
      id: string;
      platform: string;
      fb_page_id: string | null;
      fb_page_name: string | null;
      ig_business_user_id: string | null;
      ig_business_username: string | null;
      account_picture_url: string | null;
      status: string;
    };

    const connections = ((data as Row[] | null) ?? []).map((r) => ({
      id: r.id,
      platform: r.platform,
      fbPageId: r.fb_page_id,
      fbPageName: r.fb_page_name,
      igBusinessUserId: r.ig_business_user_id,
      igBusinessUsername: r.ig_business_username,
      pictureUrl: r.account_picture_url,
      // Per-platform availability for the wizard. A Meta connection
      // always supports Facebook posting; IG only when an IG
      // Business account was linked at OAuth time.
      canPublishFacebook: r.platform === "meta" && !!r.fb_page_id,
      canPublishInstagram: r.platform === "meta" && !!r.ig_business_user_id,
    }));

    return NextResponse.json({ ok: true, connections });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load connections";
    console.error("[leads-gen/connections]", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
