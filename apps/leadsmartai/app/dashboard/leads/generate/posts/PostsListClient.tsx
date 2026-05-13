"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

/**
 * Reconstruct the Quick Post deep-link params from a lead_post row.
 * Only CRM-anchored triggers (new_listing / open_house / price_drop
 * / just_sold) yield a useful follow-up — synthetic triggers
 * (custom / market_update / testimonial / by_address) have no
 * subject to carry forward.
 *
 * Subjects.ts emits wire ids like `listing:<uuid>` /
 * `open_house:<uuid>` / `transaction:<uuid>` — we reconstruct that
 * format from the row's denormalized columns so /post/new picks
 * up `?trigger=…&subjectId=…` and auto-selects the subject in step 2.
 */
function reconstructFollowUpHref(post: {
  triggerKind: string | null;
  subjectKind: string | null;
  subjectRefId: string | null;
}): string | null {
  const t = post.triggerKind;
  if (
    t !== "new_listing" &&
    t !== "open_house" &&
    t !== "price_drop" &&
    t !== "just_sold"
  ) {
    return null;
  }
  if (!post.subjectKind || !post.subjectRefId) return null;
  const subjectId = `${post.subjectKind}:${post.subjectRefId}`;
  const params = new URLSearchParams({ trigger: t, subjectId });
  return `/dashboard/leads/generate/post/new?${params.toString()}`;
}

/**
 * Published-posts list — client interactions:
 *   - Per-row "Refresh metrics" button (POST /[id]/refresh)
 *   - Click-through to the external post URL
 *
 * Server-renders the initial metrics; clicking Refresh hits Meta's
 * Graph API live and re-renders the row locally without a full
 * page reload (we hold the metrics in component state).
 */

export type PublishedPostRow = {
  id: string;
  platform: string;
  caption: string;
  hashtags: string[];
  mediaLibraryId: string | null;
  thumbnailUrl: string | null;
  externalPostId: string | null;
  externalPostUrl: string | null;
  triggerKind: string | null;
  subjectKind: string | null;
  subjectRefId: string | null;
  status: string;
  errorMessage: string | null;
  metrics: Record<string, unknown>;
  metricsRefreshedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  pageName: string | null;
  igBusinessUsername: string | null;
  linkedinDisplayName: string | null;
};

type MetricsMap = Record<string, number | null>;

type RowState = {
  metrics: MetricsMap;
  metricsRefreshedAt: string | null;
  refreshing: boolean;
  refreshError: string | null;
};

export default function PostsListClient({
  posts,
}: {
  posts: PublishedPostRow[];
}) {
  // Track per-row metrics state so Refresh updates feel instant
  // without a full router.refresh().
  const initial = useMemo(() => {
    const map: Record<string, RowState> = {};
    for (const p of posts) {
      map[p.id] = {
        metrics: p.metrics as MetricsMap,
        metricsRefreshedAt: p.metricsRefreshedAt,
        refreshing: false,
        refreshError: null,
      };
    }
    return map;
  }, [posts]);
  const [rowState, setRowState] = useState<Record<string, RowState>>(initial);

  const refresh = useCallback(async (id: string) => {
    setRowState((s) => ({
      ...s,
      [id]: { ...s[id], refreshing: true, refreshError: null },
    }));
    try {
      const res = await fetch(`/api/leads-gen/posts/${id}/refresh`, {
        method: "POST",
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        metrics?: MetricsMap | null;
        refreshedAt?: string;
        error?: string;
      };
      if (!res.ok || !body.ok) {
        setRowState((s) => ({
          ...s,
          [id]: {
            ...s[id],
            refreshing: false,
            refreshError: body.error ?? "Refresh failed",
            // The server still stamps refreshedAt on LinkedIn 422s; reflect that.
            metricsRefreshedAt:
              body.refreshedAt ?? s[id].metricsRefreshedAt,
          },
        }));
        return;
      }
      setRowState((s) => ({
        ...s,
        [id]: {
          metrics: body.metrics ?? s[id].metrics,
          metricsRefreshedAt: body.refreshedAt ?? new Date().toISOString(),
          refreshing: false,
          refreshError: null,
        },
      }));
    } catch (e) {
      setRowState((s) => ({
        ...s,
        [id]: {
          ...s[id],
          refreshing: false,
          refreshError: e instanceof Error ? e.message : "Refresh failed",
        },
      }));
    }
  }, []);

  if (posts.length === 0) return <EmptyState />;

  const published = posts.filter((p) => p.status === "published");
  const failed = posts.filter((p) => p.status === "failed");

  return (
    <div className="space-y-8">
      {published.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">
            Published ({published.length})
          </h2>
          <div className="space-y-3">
            {published.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                state={rowState[p.id]}
                onRefresh={() => void refresh(p.id)}
              />
            ))}
          </div>
        </section>
      )}

      {failed.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-red-700">
            Failed ({failed.length})
          </h2>
          <div className="space-y-3">
            {failed.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                state={rowState[p.id]}
                onRefresh={() => void refresh(p.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PostCard({
  post,
  state,
  onRefresh,
}: {
  post: PublishedPostRow;
  state: RowState;
  onRefresh: () => void;
}) {
  const platformLabel =
    post.platform === "facebook"
      ? "Facebook"
      : post.platform === "instagram"
        ? "Instagram"
        : "LinkedIn";
  const platformAccent =
    post.platform === "facebook"
      ? "bg-blue-100 text-blue-700"
      : post.platform === "instagram"
        ? "bg-pink-100 text-pink-700"
        : "bg-sky-100 text-sky-700";
  const accountName =
    post.pageName ??
    post.igBusinessUsername ??
    post.linkedinDisplayName ??
    "—";

  const publishedAt = post.publishedAt
    ? new Date(post.publishedAt)
    : new Date(post.createdAt);

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex gap-4">
        {post.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.thumbnailUrl}
            alt=""
            className="h-20 w-20 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-2xl">
            📝
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`rounded-full px-2 py-0.5 font-semibold ${platformAccent}`}
            >
              {platformLabel}
            </span>
            <span className="text-gray-600">{accountName}</span>
            <span className="text-gray-400">·</span>
            <time className="text-gray-500">
              {publishedAt.toLocaleString([], {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </time>
            {post.triggerKind && (
              <>
                <span className="text-gray-400">·</span>
                <span className="text-gray-500">
                  {triggerLabel(post.triggerKind)}
                </span>
              </>
            )}
          </div>

          <p className="line-clamp-3 whitespace-pre-wrap text-sm text-gray-800">
            {post.caption}
          </p>

          {post.hashtags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {post.hashtags.slice(0, 6).map((h) => (
                <span
                  key={h}
                  className="text-xs text-gray-500"
                >
                  #{h.replace(/^#/, "")}
                </span>
              ))}
            </div>
          )}

          {post.status === "failed" && post.errorMessage && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              <strong className="block">Publish failed</strong>
              {post.errorMessage}
            </div>
          )}

          {post.status === "published" && (
            <MetricsRow metrics={state.metrics} platform={post.platform} />
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
            {post.externalPostUrl && (
              <a
                href={post.externalPostUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-blue-700 hover:text-blue-900"
              >
                View on {platformLabel} →
              </a>
            )}
            {post.status === "published" && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={state.refreshing}
                className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {state.refreshing ? "Refreshing…" : "Refresh metrics"}
              </button>
            )}
            {(() => {
              const followUpHref = reconstructFollowUpHref(post);
              if (!followUpHref) return null;
              return (
                <Link
                  href={followUpHref}
                  className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  + Post follow-up
                </Link>
              );
            })()}
            <span className="text-gray-400">
              {state.metricsRefreshedAt
                ? `Last refresh: ${new Date(state.metricsRefreshedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                : post.status === "published"
                  ? "No metrics yet — refresh to fetch"
                  : ""}
            </span>
            {state.refreshError && (
              <span className="text-red-700">{state.refreshError}</span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function MetricsRow({
  metrics,
  platform,
}: {
  metrics: MetricsMap;
  platform: string;
}) {
  // Order tuned per platform — surface the most-meaningful number
  // first. FB foregrounds reach + reactions; IG foregrounds reach
  // + likes; LinkedIn (no metrics available) shows the placeholder.
  const cells: Array<{ label: string; value: number | null }> =
    platform === "instagram"
      ? [
          { label: "Likes", value: getNum(metrics, "likes") },
          { label: "Comments", value: getNum(metrics, "comments") },
          { label: "Saves", value: getNum(metrics, "saves") },
          { label: "Reach", value: getNum(metrics, "reach") },
          { label: "Impressions", value: getNum(metrics, "impressions") },
        ]
      : platform === "facebook"
        ? [
            { label: "Reactions", value: getNum(metrics, "likes") },
            { label: "Comments", value: getNum(metrics, "comments") },
            { label: "Shares", value: getNum(metrics, "shares") },
            { label: "Reach", value: getNum(metrics, "reach") },
            { label: "Impressions", value: getNum(metrics, "impressions") },
            { label: "Clicks", value: getNum(metrics, "clicks") },
          ]
        : [];

  if (cells.length === 0) {
    return (
      <p className="mt-3 text-xs italic text-gray-400">
        LinkedIn analytics aren&apos;t available via the API. View the post on
        LinkedIn for engagement.
      </p>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {cells.map((c) => (
        <span key={c.label}>
          <strong className="text-gray-900">
            {c.value == null ? "—" : c.value.toLocaleString()}
          </strong>{" "}
          <span className="text-gray-500">{c.label}</span>
        </span>
      ))}
    </div>
  );
}

function getNum(m: Record<string, unknown>, key: string): number | null {
  const v = m[key];
  return typeof v === "number" ? v : null;
}

function triggerLabel(t: string): string {
  switch (t) {
    case "new_listing":
      return "New listing";
    case "open_house":
      return "Open house";
    case "price_drop":
      return "Price drop";
    case "just_sold":
      return "Just sold";
    case "market_update":
      return "Market update";
    case "testimonial":
      return "Testimonial";
    case "custom":
      return "Custom";
    case "by_address":
      return "By address";
    default:
      return t;
  }
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
      <div className="mb-2 text-3xl">📭</div>
      <p className="text-sm font-semibold text-gray-900">
        No published posts yet
      </p>
      <p className="mt-1 text-sm text-gray-500">
        Once you publish a post from the wizard, it shows up here with
        engagement metrics.
      </p>
    </div>
  );
}
