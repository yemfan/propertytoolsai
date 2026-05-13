import { NextResponse } from "next/server";

import { requireMobileAgent } from "@/lib/mobile/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * GET /api/mobile/leads-gen/schedule/list
 *
 * Returns the agent's scheduled + recently-posted/failed posts.
 * Newest scheduled_for first. Joins social_accounts for the display
 * name (Page name for Meta, member display name for LinkedIn).
 *
 * Mobile-side counterpart to /api/leads-gen/schedule/list.
 */
export async function GET(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const { data: rows, error } = await supabaseAdmin
      .from("scheduled_posts")
      .select(
        "id, social_account_id, platform, caption, hashtags, media_library_id, scheduled_for, status, attempt_count, next_attempt_at, last_error, published_lead_post_id, published_at, created_at",
      )
      .eq("agent_id", auth.ctx.agentId)
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
    let displayByAccount = new Map<
      string,
      { fbPageName: string | null; igUsername: string | null; linkedinName: string | null }
    >();
    if (socialAccountIds.length > 0) {
      const { data: connRows } = await supabaseAdmin
        .from("social_accounts")
        .select(
          "id, platform, fb_page_name, ig_business_username, account_display_name",
        )
        .in("id", socialAccountIds);
      displayByAccount = new Map(
        ((connRows as Array<{
          id: string;
          platform: string;
          fb_page_name: string | null;
          ig_business_username: string | null;
          account_display_name: string | null;
        }> | null) ?? []).map((r) => [
          r.id,
          {
            fbPageName: r.fb_page_name,
            igUsername: r.ig_business_username,
            linkedinName:
              r.platform === "linkedin" ? r.account_display_name : null,
          },
        ]),
      );
    }

    // Pull external_post_url for posts that landed so the UI can
    // link out to "View the post →".
    const publishedLeadPostIds = list
      .map((r) => r.published_lead_post_id)
      .filter((id): id is string => Boolean(id));
    let leadPostUrlById = new Map<string, string | null>();
    if (publishedLeadPostIds.length > 0) {
      const { data: leadPostRows } = await supabaseAdmin
        .from("lead_posts")
        .select("id, external_post_url")
        .in("id", publishedLeadPostIds);
      leadPostUrlById = new Map(
        ((leadPostRows as Array<{
          id: string;
          external_post_url: string | null;
        }> | null) ?? []).map((r) => [r.id, r.external_post_url]),
      );
    }

    const scheduled = list.map((r) => {
      const display = displayByAccount.get(r.social_account_id) ?? null;
      const publishedUrl = r.published_lead_post_id
        ? leadPostUrlById.get(r.published_lead_post_id) ?? null
        : null;
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
        publishedUrl,
        pageName: display?.fbPageName ?? null,
        igBusinessUsername: display?.igUsername ?? null,
        linkedinDisplayName: display?.linkedinName ?? null,
        createdAt: r.created_at,
      };
    });

    return NextResponse.json({ ok: true, success: true, scheduled });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load";
    console.error("[mobile/leads-gen/schedule/list]", e);
    return NextResponse.json(
      { ok: false, success: false, error: msg },
      { status: 500 },
    );
  }
}
