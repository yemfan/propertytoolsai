"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

/**
 * Lead Ad campaigns dashboard — client interactions:
 *   - Pause / resume / archive a campaign (POSTs /[id]/status)
 *   - Refresh insights from Meta (POSTs /[id]/refresh)
 *   - "View in Ads Manager" deep link
 *
 * The list itself is server-rendered above; after a row action we
 * `router.refresh()` to re-fetch fresh server state. Optimistic UI
 * would feel snappier but the server is the source of truth and
 * the round-trip is sub-second.
 */

export type CampaignRow = {
  id: string;
  name: string;
  status: string;
  lastError: string | null;
  pageName: string | null;
  igBusinessUsername: string | null;
  metaCampaignId: string | null;
  metaAdAccountId: string | null;
  dailyBudgetCents: number | null;
  startTime: string | null;
  endTime: string | null;
  leadsReceivedCount: number;
  lastLeadAt: string | null;
  metrics: Record<string, unknown>;
  metricsRefreshedAt: string | null;
  launchedAt: string | null;
  createdAt: string;
};

type Metrics = {
  impressions?: number;
  reach?: number;
  clicks?: number;
  inlineLinkClicks?: number;
  leads?: number;
  spendCents?: number;
  cpmCents?: number | null;
  cpcCents?: number | null;
  cplCents?: number | null;
  metaUpdatedAt?: string | null;
};

export default function CampaignListClient({
  campaigns,
}: {
  campaigns: CampaignRow[];
}) {
  const router = useRouter();
  const [actingId, setActingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const onStatusChange = useCallback(
    async (id: string, action: "pause" | "resume" | "archive") => {
      const verbs: Record<typeof action, string> = {
        pause: "pause",
        resume: "resume",
        archive: "archive",
      };
      if (action === "archive" && !confirm("Archive this campaign? It stays in Meta but can't be edited afterward.")) {
        return;
      }
      setActionError(null);
      setActingId(id);
      try {
        const res = await fetch(`/api/leads-gen/ads/${id}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
        };
        if (!res.ok || !body.ok) {
          throw new Error(body.error ?? `Failed to ${verbs[action]}`);
        }
        router.refresh();
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "Action failed");
      } finally {
        setActingId(null);
      }
    },
    [router],
  );

  const onRefresh = useCallback(
    async (id: string) => {
      setActionError(null);
      setActingId(id);
      try {
        const res = await fetch(`/api/leads-gen/ads/${id}/refresh`, {
          method: "POST",
        });
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
        };
        if (!res.ok || !body.ok) {
          throw new Error(body.error ?? "Refresh failed");
        }
        router.refresh();
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "Refresh failed");
      } finally {
        setActingId(null);
      }
    },
    [router],
  );

  if (campaigns.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-4">
      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {actionError}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50/60 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Campaign</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Budget</th>
              <th className="px-3 py-3">Spend</th>
              <th className="px-3 py-3">Impressions</th>
              <th className="px-3 py-3">Leads</th>
              <th className="px-3 py-3">CPL</th>
              <th className="px-3 py-3">Refreshed</th>
              <th className="px-3 py-3 w-1" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {campaigns.map((c) => (
              <CampaignRowView
                key={c.id}
                campaign={c}
                onStatusChange={onStatusChange}
                onRefresh={onRefresh}
                busy={actingId === c.id}
              />
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        Leads count comes from real-time webhooks (canonical). The Meta
        Insights leads number can lag a few hours; we show the webhook
        count to avoid undercount.
      </p>
    </div>
  );
}

// ── Row ──────────────────────────────────────────────────────────────

function CampaignRowView({
  campaign: c,
  onStatusChange,
  onRefresh,
  busy,
}: {
  campaign: CampaignRow;
  onStatusChange: (id: string, action: "pause" | "resume" | "archive") => void;
  onRefresh: (id: string) => void;
  busy: boolean;
}) {
  const metrics = c.metrics as Metrics;
  const adsManagerUrl = c.metaCampaignId
    ? `https://adsmanager.facebook.com/adsmanager/manage/campaigns?selected_campaign_ids=${encodeURIComponent(c.metaCampaignId)}`
    : null;

  return (
    <tr className="text-gray-800">
      <td className="px-4 py-3 align-top">
        <div className="font-medium text-gray-900">{c.name}</div>
        <div className="text-xs text-gray-500">
          {c.pageName ?? "—"}
          {c.igBusinessUsername ? ` · IG @${c.igBusinessUsername}` : ""}
        </div>
        {c.lastError && (
          <div className="mt-1 truncate text-xs text-red-700" title={c.lastError}>
            {c.lastError}
          </div>
        )}
      </td>

      <td className="px-3 py-3 align-top">
        <StatusBadge status={c.status} />
      </td>

      <td className="px-3 py-3 align-top text-gray-700">
        {c.dailyBudgetCents != null
          ? `$${(c.dailyBudgetCents / 100).toFixed(0)}/day`
          : "—"}
        <div className="text-xs text-gray-500">
          {compactDateRange(c.startTime, c.endTime)}
        </div>
      </td>

      <td className="px-3 py-3 align-top text-gray-700">
        {metrics.spendCents != null
          ? `$${(metrics.spendCents / 100).toFixed(2)}`
          : "—"}
      </td>

      <td className="px-3 py-3 align-top text-gray-700">
        {metrics.impressions != null
          ? metrics.impressions.toLocaleString()
          : "—"}
      </td>

      <td className="px-3 py-3 align-top">
        <span className="font-semibold text-gray-900">
          {c.leadsReceivedCount}
        </span>
        {metrics.leads && metrics.leads > c.leadsReceivedCount ? (
          <span
            className="ml-1 text-xs text-amber-700"
            title={`Meta Insights reports ${metrics.leads} — webhook count is canonical`}
          >
            (Meta: {metrics.leads})
          </span>
        ) : null}
      </td>

      <td className="px-3 py-3 align-top text-gray-700">
        {metrics.cplCents != null
          ? `$${(metrics.cplCents / 100).toFixed(2)}`
          : "—"}
      </td>

      <td className="px-3 py-3 align-top text-xs text-gray-500">
        {c.metricsRefreshedAt
          ? friendlyAgo(c.metricsRefreshedAt)
          : "Never"}
      </td>

      <td className="px-3 py-3 align-top text-right">
        <RowActions
          campaign={c}
          onStatusChange={onStatusChange}
          onRefresh={onRefresh}
          adsManagerUrl={adsManagerUrl}
          busy={busy}
        />
      </td>
    </tr>
  );
}

// ── Actions ──────────────────────────────────────────────────────────

function RowActions({
  campaign: c,
  onStatusChange,
  onRefresh,
  adsManagerUrl,
  busy,
}: {
  campaign: CampaignRow;
  onStatusChange: (id: string, action: "pause" | "resume" | "archive") => void;
  onRefresh: (id: string) => void;
  adsManagerUrl: string | null;
  busy: boolean;
}) {
  // Per-state action affordances:
  //   - paused / draft  → Resume (when Meta-side exists), Archive
  //   - active          → Pause, Archive
  //   - creating        → no actions (mid-orchestration)
  //   - failed          → Archive only
  //   - completed       → no actions (terminal)
  const canResume = c.status === "paused" && c.metaCampaignId !== null;
  const canPause = c.status === "active";
  const canArchive = c.status !== "completed" && c.status !== "creating" && c.metaCampaignId !== null;
  const canRefresh = c.metaCampaignId !== null && c.status !== "creating" && c.status !== "draft";

  return (
    <div className="flex shrink-0 items-center justify-end gap-1.5">
      {canRefresh && (
        <button
          type="button"
          onClick={() => onRefresh(c.id)}
          disabled={busy}
          className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          title="Pull fresh insights from Meta"
        >
          {busy ? "…" : "↻ Refresh"}
        </button>
      )}
      {canResume && (
        <button
          type="button"
          onClick={() => onStatusChange(c.id, "resume")}
          disabled={busy}
          className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
        >
          Resume
        </button>
      )}
      {canPause && (
        <button
          type="button"
          onClick={() => onStatusChange(c.id, "pause")}
          disabled={busy}
          className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
        >
          Pause
        </button>
      )}
      {canArchive && (
        <button
          type="button"
          onClick={() => onStatusChange(c.id, "archive")}
          disabled={busy}
          className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          title="Archive in Meta (stays for history, can't be edited)"
        >
          Archive
        </button>
      )}
      {adsManagerUrl && (
        <a
          href={adsManagerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
          title="Open in Meta Ads Manager"
        >
          ↗ Meta
        </a>
      )}
    </div>
  );
}

// ── Display helpers ──────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; fg: string }> = {
    draft: { label: "Draft", bg: "bg-gray-100", fg: "text-gray-700" },
    creating: { label: "Creating…", bg: "bg-blue-100", fg: "text-blue-700" },
    active: { label: "Active", bg: "bg-emerald-100", fg: "text-emerald-800" },
    paused: { label: "Paused", bg: "bg-amber-100", fg: "text-amber-900" },
    completed: { label: "Completed", bg: "bg-gray-100", fg: "text-gray-600" },
    failed: { label: "Failed", bg: "bg-red-100", fg: "text-red-700" },
  };
  const m = map[status] ?? {
    label: status,
    bg: "bg-gray-100",
    fg: "text-gray-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${m.bg} ${m.fg}`}
    >
      {m.label}
    </span>
  );
}

function compactDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return "";
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  if (start && end) return `${fmt(start)} → ${fmt(end)}`;
  if (start) return `from ${fmt(start)}`;
  if (end) return `until ${fmt(end!)}`;
  return "";
}

function friendlyAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

// ── Empty state ──────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/40 p-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312"
          />
        </svg>
      </div>
      <h2 className="text-base font-semibold text-gray-900">
        No campaigns yet
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        Launch your first Lead Ad campaign to pull warm leads straight into
        your CRM.
      </p>
      <Link
        href="/dashboard/leads/generate/ads/new"
        className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        + New campaign
      </Link>
    </div>
  );
}
