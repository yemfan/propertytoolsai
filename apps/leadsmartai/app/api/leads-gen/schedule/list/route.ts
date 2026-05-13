import { NextResponse } from "next/server";

import { getDashboardAgentContext } from "@/lib/contact-intake/dashboardAgentContext";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * GET /api/leads-gen/schedule/list
 *
 * Returns the agent's scheduled + recently-posted/failed posts.
 * Newest scheduled_for first. Joins social_accounts for the Page
 * name display.
 *
 * Use this endpoint for the management dashboard (the server-
 * rendered page does its own SELECT for first paint; this is for
 * client-side refreshes after cancel actions).
 */
export async function GET() {
  try {
    const auth = await getDashboardAgentContext();
    if (auth.ok === false) return auth.response;

    if (auth.planType === "free") {
      return NextResponse.json({ ok: true, scheduled: [] });
    }

    const { data: rows, error } = await supabaseAdmin
      .from("scheduled_posts")
      .select(
        "id, social_account_id, platform, caption, hashtags, media_library_id, scheduled_for, status, attempt_count, next_attempt_at, last_error, published_lead_post_id, published_at, created_at",
      )
      .eq("agent_id", auth.agentId)
      .order("scheduled_for", { ascending: false })
      .limit(200);
    if (error) throw error;

    type Row = {
      id: string;
      social_account_id: string;
      platform: string;
      caption: string;
      hashtags: string[];
      media_library_id: string | null;
      scheduled_for: string;
      status: string;
      attempt_count: number;
      next_attempt_at: string | null;
      last_error: string | null;
      published_lead_post_id: string | null;
      published_at: string | null;
      created_at: string;
    };

    const list = ((rows as Row[] | null) ?? []);
    const socialAccountIds = Array.from(
      new Set(list.map((r) => r.social_account_id)),
    );
    let pageById = new Map<
      string,
      { fb_page_name: string | null; ig_business_username: string | null }
    >();
    if (socialAccountIds.length > 0) {
      const { data: connRows } = await supabaseAdmin
        .from("social_accounts")
        .select("id, fb_page_name, ig_business_username")
        .in("id", socialAccountIds);
      pageById = new Map(
        ((connRows as Array<{
          id: string;
          fb_page_name: string | null;
          ig_business_username: string | null;
        }> | null) ?? []).map((r) => [r.id, r]),
      );
    }

    const scheduled = list.map((r) => {
      const page = pageById.get(r.social_account_id) ?? null;
      return {
        id: r.id,
        platform: r.platform,
        caption: r.caption,
        hashtags: r.hashtags,
        mediaLibraryId: r.media_library_id,
        scheduledFor: r.scheduled_for,
        status: r.status,
        attemptCount: r.attempt_count,
        nextAttemptAt: r.next_attempt_at,
        lastError: r.last_error,
        publishedLeadPostId: r.published_lead_post_id,
        publishedAt: r.published_at,
        pageName: page?.fb_page_name ?? null,
        igBusinessUsername: page?.ig_business_username ?? null,
        createdAt: r.created_at,
      };
    });

    return NextResponse.json({ ok: true, scheduled });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load scheduled posts";
    console.error("[leads-gen/schedule/list]", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
