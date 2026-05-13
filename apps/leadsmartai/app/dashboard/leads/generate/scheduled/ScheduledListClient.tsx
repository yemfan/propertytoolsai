"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

/**
 * Scheduled posts list — client interactions:
 *   - Cancel a scheduled / posting row (POSTs /[id]/cancel)
 *   - View the published Meta post URL (when status='posted')
 *   - Surface failure reasons inline for status='failed' rows
 *
 * The list is server-rendered above; we router.refresh() after
 * cancel to re-fetch.
 *
 * Visual organization splits the rows into three buckets so the
 * agent's eye can land on the relevant section:
 *   1. Upcoming  (scheduled + posting status, scheduled_for >= now)
 *   2. Failed    (failed status only, surfaces errors)
 *   3. Recent    (posted + cancelled status — historical record)
 */

export type ScheduledRow = {
  id: string;
  platform: string;
  caption: string;
  hashtags: string[];
  mediaLibraryId: string | null;
  scheduledFor: string;
  status: string;
  attemptCount: number;
  nextAttemptAt: string | null;
  lastError: string | null;
  publishedLeadPostId: string | null;
  publishedAt: string | null;
  publishedUrl: string | null;
  pageName: string | null;
  igBusinessUsername: string | null;
  createdAt: string;
};

export default function ScheduledListClient({
  scheduled,
}: {
  scheduled: ScheduledRow[];
}) {
  const router = useRouter();
  const [actingId, setActingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { upcoming, failed, recent } = useMemo(() => {
    const u: ScheduledRow[] = [];
    const f: ScheduledRow[] = [];
    const r: ScheduledRow[] = [];
    for (const row of scheduled) {
      if (row.status === "scheduled" || row.status === "posting") {
        u.push(row);
      } else if (row.status === "failed") {
        f.push(row);
      } else {
        r.push(row);
      }
    }
    return { upcoming: u, failed: f, recent: r };
  }, [scheduled]);

  const onCancel = useCallback(
    async (id: string) => {
      if (!confirm("Cancel this scheduled post? The draft isn't deleted — you can re-schedule from the wizard.")) {
        return;
      }
      setActionError(null);
      setActingId(id);
      try {
        const res = await fetch(`/api/leads-gen/schedule/${id}/cancel`, {
          method: "POST",
        });
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
        };
        if (!res.ok || !body.ok) {
          throw new Error(body.error ?? "Cancel failed");
        }
        router.refresh();
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "Cancel failed");
      } finally {
        setActingId(null);
      }
    },
    [router],
  );

  if (scheduled.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-6">
      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {actionError}
        </div>
      )}

      {upcoming.length > 0 && (
        <Section title="Upcoming" count={upcoming.length}>
          <RowTable rows={upcoming} variant="upcoming" onCancel={onCancel} actingId={actingId} />
        </Section>
      )}

      {failed.length > 0 && (
        <Section title="Failed" count={failed.length} accent="red">
          <RowTable rows={failed} variant="failed" onCancel={onCancel} actingId={actingId} />
        </Section>
      )}

      {recent.length > 0 && (
        <Section title="Recent" count={recent.length}>
          <RowTable rows={recent} variant="recent" onCancel={onCancel} actingId={actingId} />
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  accent,
  children,
}: {
  title: string;
  count: number;
  accent?: "red";
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2
        className={`mb-2 text-sm font-semibold ${
          accent === "red" ? "text-red-700" : "text-gray-900"
        }`}
      >
        {title} <span className="text-gray-400">({count})</span>
      </h2>
      {children}
    </section>
  );
}

function RowTable({
  rows,
  variant,
  onCancel,
  actingId,
}: {
  rows: ScheduledRow[];
  variant: "upcoming" | "failed" | "recent";
  onCancel: (id: string) => void;
  actingId: string | null;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50/60 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3">Caption</th>
            <th className="px-3 py-3">Platform / Page</th>
            <th className="px-3 py-3">
              {variant === "recent" ? "Published" : "Scheduled for"}
            </th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3 w-1" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r) => (
            <tr key={r.id} className="text-gray-800 align-top">
              <td className="px-4 py-3 max-w-md">
                <div className="line-clamp-2 text-sm text-gray-800">
                  {r.caption}
                </div>
                {r.hashtags.length > 0 && (
                  <div className="mt-1 truncate text-xs text-gray-500">
                    {r.hashtags.map((t) => `#${t}`).join(" ")}
                  </div>
                )}
                {r.lastError && variant === "failed" && (
                  <div className="mt-1 text-xs text-red-700">{r.lastError}</div>
                )}
              </td>
              <td className="px-3 py-3 text-gray-700">
                <PlatformBadge platform={r.platform} />
                <div className="mt-0.5 text-xs text-gray-500">
                  {r.platform === "instagram" && r.igBusinessUsername
                    ? `@${r.igBusinessUsername}`
                    : r.pageName ?? "—"}
                </div>
              </td>
              <td className="px-3 py-3 text-gray-700">
                {variant === "recent" && r.publishedAt
                  ? new Date(r.publishedAt).toLocaleString()
                  : new Date(r.scheduledFor).toLocaleString()}
                {variant === "upcoming" && r.attemptCount > 0 && (
                  <div className="text-xs text-amber-700">
                    Retry {r.attemptCount}/3
                  </div>
                )}
              </td>
              <td className="px-3 py-3">
                <StatusBadge status={r.status} />
              </td>
              <td className="px-3 py-3 text-right">
                <RowActions
                  row={r}
                  variant={variant}
                  onCancel={onCancel}
                  busy={actingId === r.id}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RowActions({
  row,
  variant,
  onCancel,
  busy,
}: {
  row: ScheduledRow;
  variant: "upcoming" | "failed" | "recent";
  onCancel: (id: string) => void;
  busy: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center justify-end gap-1.5">
      {variant === "recent" && row.publishedUrl && (
        <a
          href={row.publishedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
          title="View the published post on the platform"
        >
          ↗ View
        </a>
      )}
      {(variant === "upcoming" || variant === "failed") && (
        <button
          type="button"
          onClick={() => onCancel(row.id)}
          disabled={busy}
          className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          {busy ? "…" : "Cancel"}
        </button>
      )}
    </div>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  const map: Record<string, { label: string; bg: string; fg: string }> = {
    facebook: { label: "Facebook", bg: "bg-blue-100", fg: "text-blue-700" },
    instagram: { label: "Instagram", bg: "bg-pink-100", fg: "text-pink-700" },
  };
  const m = map[platform] ?? { label: platform, bg: "bg-gray-100", fg: "text-gray-700" };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${m.bg} ${m.fg}`}
    >
      {m.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; fg: string }> = {
    scheduled: { label: "Scheduled", bg: "bg-indigo-100", fg: "text-indigo-700" },
    posting: { label: "Posting…", bg: "bg-amber-100", fg: "text-amber-900" },
    posted: { label: "Posted", bg: "bg-emerald-100", fg: "text-emerald-800" },
    failed: { label: "Failed", bg: "bg-red-100", fg: "text-red-700" },
    cancelled: { label: "Cancelled", bg: "bg-gray-100", fg: "text-gray-600" },
  };
  const m = map[status] ?? { label: status, bg: "bg-gray-100", fg: "text-gray-700" };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${m.bg} ${m.fg}`}
    >
      {m.label}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/40 p-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h2 className="text-base font-semibold text-gray-900">
        Nothing scheduled
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        Draft a Quick Post and choose &ldquo;Schedule for later&rdquo; to queue it
        up — handy for Saturday open-house reminders and Sunday recaps.
      </p>
      <Link
        href="/dashboard/leads/generate/post/new"
        className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Draft a post
      </Link>
    </div>
  );
}
