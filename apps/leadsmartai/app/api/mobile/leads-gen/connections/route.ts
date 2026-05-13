import { NextResponse } from "next/server";

import { requireMobileAgent } from "@/lib/mobile/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * GET /api/mobile/leads-gen/connections
 *
 * Mobile-side counterpart to /api/leads-gen/connections. Returns
 * the agent's social-platform connections so the Quick Post screen
 * can render "Publish to Facebook" / "Publish to Instagram" buttons
 * when a connection exists. Tokens are intentionally omitted — only
 * display + capability flags leave the server.
 *
 * Mobile auth: Supabase Bearer (same as the rest of /api/mobile/*).
 */
export async function GET(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const { data, error } = await supabaseAdmin
      .from("social_accounts")
      .select(
        "id, platform, fb_page_id, fb_page_name, ig_business_user_id, ig_business_username, account_picture_url, status",
      )
      .eq("agent_id", auth.ctx.agentId)
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
      canPublishFacebook: r.platform === "meta" && !!r.fb_page_id,
      canPublishInstagram: r.platform === "meta" && !!r.ig_business_user_id,
    }));

    return NextResponse.json({ ok: true, success: true, connections });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load connections";
    console.error("[mobile/leads-gen/connections]", e);
    return NextResponse.json(
      { ok: false, success: false, error: msg },
      { status: 500 },
    );
  }
}
