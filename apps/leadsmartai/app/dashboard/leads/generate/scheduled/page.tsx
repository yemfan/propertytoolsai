import type { Metadata } from "next";
import Link from "next/link";

import { getCurrentAgentContext } from "@/lib/dashboardService";
import { supabaseAdmin } from "@/lib/supabase/admin";

import ScheduledListClient, {
  type ScheduledRow,
} from "./ScheduledListClient";

export const metadata: Metadata = {
  title: "Scheduled Posts | LeadSmart AI",
  description:
    "Queue of social posts waiting to publish, plus recent results.",
  robots: { index: false },
};

/**
 * Scheduled posts dashboard. Server-renders the queue (token-free
 * SELECT) and hands to the client component for cancel actions.
 */
export default async function ScheduledPostsPage() {
  const { agentId } = await getCurrentAgentContext();

  const { data, error } = await supabaseAdmin
    .from("scheduled_posts")
    .select(
      "id, social_account_id, platform, caption, hashtags, media_library_id, scheduled_for, status, attempt_count, next_attempt_at, last_error, published_lead_post_id, published_at, created_at",
    )
    .eq("agent_id", String(agentId))
    .order("scheduled_for", { ascending: false })
    .limit(200);

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <p className="text-sm text-red-700">
          Couldn&apos;t load scheduled posts: {error.message}
        </p>
      </div>
    );
  }

  type DbRow = {
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
  const rows = (data as DbRow[] | null) ?? [];

  // Pull Page name for the connection (display).
  const socialAccountIds = Array.from(
    new Set(rows.map((r) => r.social_account_id)),
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

  // For successful posts, pull the lead_posts URL so the row can deep-link
  // out to the live post on Meta.
  const publishedIds = rows
    .map((r) => r.published_lead_post_id)
    .filter((id): id is string => Boolean(id));
  let leadPostUrlById = new Map<string, string | null>();
  if (publishedIds.length > 0) {
    const { data: leadPostRows } = await supabaseAdmin
      .from("lead_posts")
      .select("id, external_post_url")
      .in("id", publishedIds);
    leadPostUrlById = new Map(
      ((leadPostRows as Array<{
        id: string;
        external_post_url: string | null;
      }> | null) ?? []).map((r) => [r.id, r.external_post_url]),
    );
  }

  const scheduled: ScheduledRow[] = rows.map((r) => {
    const page = pageById.get(r.social_account_id) ?? null;
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
      pageName: page?.fb_page_name ?? null,
      igBusinessUsername: page?.ig_business_username ?? null,
      createdAt: r.created_at,
    };
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Scheduled Posts
          </h1>
          <p className="text-sm text-gray-500">
            Posts queued to publish later, plus recent results.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/dashboard/leads/generate"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            &larr; Generate Leads
          </Link>
          <Link
            href="/dashboard/leads/generate/recurring"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            🔁 Recurring
          </Link>
          <Link
            href="/dashboard/leads/generate/post/new"
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            + New post
          </Link>
        </div>
      </div>

      <ScheduledListClient scheduled={scheduled} />
    </div>
  );
}
