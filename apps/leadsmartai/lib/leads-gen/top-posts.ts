import "server-only";

import {
  LEAD_MEDIA_BUCKET,
  SIGNED_URL_TTL_SECONDS,
} from "@/lib/leads-gen/media";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Top-posts ranking helper. Reads recent published lead_posts for
 * an agent, scores each by total engagement (likes + comments +
 * shares + saves — visibility metrics like impressions / reach
 * don't count toward the ranking), and returns the top N with
 * resolved thumbnail signed URLs + connection display names.
 *
 * Powers the "Top performers" surfaces:
 *   - Mobile Home "Engagement" section
 *   - Web posts page "Top performers" strip
 *
 * Window: last 14 days. Same horizon the refresh-post-metrics cron
 * keeps fresh — anything older isn't worth surfacing because the
 * cron stopped touching it.
 */

export type TopPostItem = {
  id: string;
  platform: "facebook" | "instagram" | "linkedin" | string;
  caption: string;
  thumbnailUrl: string | null;
  externalPostUrl: string | null;
  publishedAt: string | null;
  pageName: string | null;
  igBusinessUsername: string | null;
  linkedinDisplayName: string | null;
  engagementScore: number;
  metrics: {
    likes: number | null;
    comments: number | null;
    shares: number | null;
    saves: number | null;
    reach: number | null;
    impressions: number | null;
  };
};

export type TopPostsSummary = {
  /** Top performers, descending by engagementScore. */
  items: TopPostItem[];
  /** Engagement window — same on every call but echoed for the UI. */
  windowDays: number;
  /** Whether any post in the window had metrics — drives empty-state messaging. */
  hasMetrics: boolean;
};

const DEFAULT_WINDOW_DAYS = 14;

function getNum(m: Record<string, unknown>, key: string): number | null {
  const v = m[key];
  return typeof v === "number" ? v : null;
}

function computeScore(m: Record<string, unknown>): number {
  // Engagement = likes/reactions + comments + shares + saves.
  // Reach + impressions are visibility, not engagement — excluded
  // so a post with high reach but zero interaction doesn't outrank
  // one that got real engagement on a smaller audience.
  return (
    (getNum(m, "likes") ?? 0) +
    (getNum(m, "comments") ?? 0) +
    (getNum(m, "shares") ?? 0) +
    (getNum(m, "saves") ?? 0)
  );
}

/**
 * Returns top-engagement posts for the given agent in the last
 * `windowDays`. Resolves thumbnails in one batched storage call.
 */
export async function getTopPosts(params: {
  agentId: string;
  limit?: number;
  windowDays?: number;
}): Promise<TopPostsSummary> {
  const limit = Math.min(Math.max(params.limit ?? 5, 1), 20);
  const windowDays = params.windowDays ?? DEFAULT_WINDOW_DAYS;
  const windowStartIso = new Date(
    Date.now() - windowDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  // Pull a wider sample than `limit` so the in-memory scoring has
  // material to work with — Postgres can't easily score a jsonb
  // sum in the ORDER BY, so we pull recent published rows and rank
  // them in JS.
  const SAMPLE_SIZE = 60;
  const { data, error } = await supabaseAdmin
    .from("lead_posts")
    .select(
      "id, social_account_id, platform, caption, media_library_id, external_post_url, metrics, metrics_refreshed_at, published_at",
    )
    .eq("agent_id", params.agentId)
    .eq("status", "published")
    .gte("published_at", windowStartIso)
    .order("published_at", { ascending: false })
    .limit(SAMPLE_SIZE);
  if (error) throw error;

  type Row = {
    id: string;
    social_account_id: string;
    platform: string;
    caption: string;
    media_library_id: string | null;
    external_post_url: string | null;
    metrics: Record<string, unknown> | null;
    metrics_refreshed_at: string | null;
    published_at: string | null;
  };

  const rows = ((data as Row[] | null) ?? []).map((r) => ({
    ...r,
    metricsObj: (r.metrics ?? {}) as Record<string, unknown>,
    score: computeScore((r.metrics ?? {}) as Record<string, unknown>),
  }));

  // Posts with no engagement data yet (just-published, never-refreshed)
  // shouldn't win the top spot just because they're newest with a
  // zero — drop them from the ranking. If NO post has any metrics
  // yet, return empty so the UI can show "no data yet" instead of a
  // tie of zero-scored posts.
  const scored = rows.filter((r) => r.score > 0);
  const hasMetrics = scored.length > 0;

  const top = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (top.length === 0) {
    return { items: [], windowDays, hasMetrics };
  }

  // Bulk-resolve thumbnails for the chosen rows.
  const mediaIds = Array.from(
    new Set(
      top
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

  // Bulk-resolve connection display names.
  const socialAccountIds = Array.from(
    new Set(top.map((r) => r.social_account_id)),
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

  const items: TopPostItem[] = top.map((r) => {
    const display = displayByAccount.get(r.social_account_id) ?? null;
    return {
      id: r.id,
      platform: r.platform,
      caption: r.caption,
      thumbnailUrl: r.media_library_id
        ? thumbByMediaId.get(r.media_library_id) ?? null
        : null,
      externalPostUrl: r.external_post_url,
      publishedAt: r.published_at,
      pageName: display?.fbPageName ?? null,
      igBusinessUsername: display?.igUsername ?? null,
      linkedinDisplayName: display?.linkedinName ?? null,
      engagementScore: r.score,
      metrics: {
        likes: getNum(r.metricsObj, "likes"),
        comments: getNum(r.metricsObj, "comments"),
        shares: getNum(r.metricsObj, "shares"),
        saves: getNum(r.metricsObj, "saves"),
        reach: getNum(r.metricsObj, "reach"),
        impressions: getNum(r.metricsObj, "impressions"),
      },
    };
  });

  return { items, windowDays, hasMetrics };
}
