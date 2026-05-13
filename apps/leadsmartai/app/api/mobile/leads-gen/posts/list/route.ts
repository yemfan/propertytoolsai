import { NextResponse } from "next/server";

import {
  LEAD_MEDIA_BUCKET,
  SIGNED_URL_TTL_SECONDS,
} from "@/lib/leads-gen/media";
import { requireMobileAgent } from "@/lib/mobile/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * GET /api/mobile/leads-gen/posts/list
 *
 * Returns the agent's published lead_posts, newest first, with
 * caption + metrics + a thumbnail signed URL for any attached
 * image. Mobile-side counterpart to the SSR'd
 * /dashboard/leads/generate/posts page.
 *
 * Default page size: 50. Pass ?limit=N to widen up to 200.
 *
 * The `metrics` jsonb is forwarded as-is; the mobile UI is the
 * source of truth for which fields it knows how to render. Empty
 * `{}` (just-published, never-refreshed) is normal.
 */
export async function GET(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const url = new URL(req.url);
    const limitParam = Number(url.searchParams.get("limit") ?? "50");
    const limit = Math.min(
      Math.max(Number.isFinite(limitParam) ? limitParam : 50, 1),
      200,
    );

    const { data: rows, error } = await supabaseAdmin
      .from("lead_posts")
      .select(
        "id, social_account_id, platform, caption, hashtags, media_library_id, external_post_id, external_post_url, trigger_kind, subject_kind, subject_ref_id, status, error_message, metrics, metrics_refreshed_at, published_at, created_at",
      )
      .eq("agent_id", auth.ctx.agentId)
      .in("status", ["published", "failed"])
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;

    type Row = {
      id: string;
      social_account_id: string;
      platform: string;
      caption: string;
      hashtags: string[] | null;
      media_library_id: string | null;
      external_post_id: string | null;
      external_post_url: string | null;
      trigger_kind: string | null;
      subject_kind: string | null;
      subject_ref_id: string | null;
      status: string;
      error_message: string | null;
      metrics: Record<string, unknown> | null;
      metrics_refreshed_at: string | null;
      published_at: string | null;
      created_at: string;
    };

    const list = ((rows as Row[] | null) ?? []);

    // Hydrate social account display names in one batch.
    const socialAccountIds = Array.from(
      new Set(list.map((r) => r.social_account_id)),
    );
    let displayByAccount = new Map<
      string,
      {
        fbPageName: string | null;
        igUsername: string | null;
        linkedinName: string | null;
      }
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

    // Bulk-resolve thumbnail signed URLs for any attached image.
    const mediaIds = Array.from(
      new Set(
        list
          .map((r) => r.media_library_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const thumbByMediaId = new Map<string, string | null>();
    if (mediaIds.length > 0) {
      const { data: mediaRows } = await supabaseAdmin
        .from("media_library")
        .select("id, storage_path")
        .in("id", mediaIds);
      const rowsArr = (mediaRows as Array<{
        id: string;
        storage_path: string;
      }> | null) ?? [];
      if (rowsArr.length > 0) {
        const paths = rowsArr.map((r) => r.storage_path);
        const { data: signedData } = await supabaseAdmin.storage
          .from(LEAD_MEDIA_BUCKET)
          .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
        const signedByPath = new Map<string, string>();
        for (const s of signedData ?? []) {
          if (s.path && s.signedUrl) signedByPath.set(s.path, s.signedUrl);
        }
        for (const m of rowsArr) {
          thumbByMediaId.set(m.id, signedByPath.get(m.storage_path) ?? null);
        }
      }
    }

    const posts = list.map((r) => {
      const display = displayByAccount.get(r.social_account_id) ?? null;
      return {
        id: r.id,
        platform: r.platform,
        caption: r.caption,
        hashtags: r.hashtags ?? [],
        mediaLibraryId: r.media_library_id,
        thumbnailUrl: r.media_library_id
          ? thumbByMediaId.get(r.media_library_id) ?? null
          : null,
        externalPostId: r.external_post_id,
        externalPostUrl: r.external_post_url,
        triggerKind: r.trigger_kind,
        subjectKind: r.subject_kind,
        subjectRefId: r.subject_ref_id,
        status: r.status,
        errorMessage: r.error_message,
        metrics: r.metrics ?? {},
        metricsRefreshedAt: r.metrics_refreshed_at,
        publishedAt: r.published_at,
        createdAt: r.created_at,
        pageName: display?.fbPageName ?? null,
        igBusinessUsername: display?.igUsername ?? null,
        linkedinDisplayName: display?.linkedinName ?? null,
      };
    });

    return NextResponse.json({ ok: true, success: true, posts });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load";
    console.error("[mobile/leads-gen/posts/list]", e);
    return NextResponse.json(
      { ok: false, success: false, error: msg },
      { status: 500 },
    );
  }
}
