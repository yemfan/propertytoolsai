"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { GrowthOpportunity, OpportunityCategory, OpportunityPriority } from "@/lib/growth/opportunityTypes";

/**
 * Growth & Opportunities.
 *
 * Top: AI-generated growth opportunities — 3-5 concrete actions the
 * agent should take this week. Cached server-side for 1h; regenerate
 * button bypasses cache.
 *
 * Below: supporting growth metrics + referral code tracking. Kept
 * minimal — the old full-dashboard version had several mismatched
 * fields that crashed render (API returns camelCase, UI read snake).
 */

type OpportunitiesResponse = {
  ok: boolean;
  opportunities: GrowthOpportunity[];
  generatedAtIso: string;
  fromCache: boolean;
  aiConfigured: boolean;
  error?: string;
};

type MetricsResponse = {
  ok: boolean;
  traffic: { pageViews: number; conversions: number; conversionRate: number; toolUsage: number };
  referrals: {
    codes: number;
    eventsSignups: number;
    eventsShares: number;
    eventsConversions: number;
  };
  viral: {
    invitesPerSharer: number;
    referralShare: number;
    viralCoefficientEstimate: number;
  };
};

type ReferralCodeRow = {
  code: string;
  label: string | null;
  signups_count: number;
  conversions_count: number;
  shares_count: number;
  created_at: string;
};

const CATEGORY_LABEL: Record<OpportunityCategory, string> = {
  stale_sphere: "Stale sphere",
  cold_hot_lead: "Cold hot lead",
  would_offer_idle: "Would-offer idle",
  stalled_offer: "Stalled offer",
  pipeline_gap: "Pipeline gap",
  source_concentration: "Source concentration",
  close_rate: "Close rate",
  anniversary_reach_out: "Anniversary",
  other: "Other",
};

const PRIORITY_BADGE: Record<OpportunityPriority, string> = {
  high: "bg-red-100 text-red-800 border-red-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  low: "bg-slate-100 text-slate-700 border-slate-200",
};

const PRIORITY_EMOJI: Record<OpportunityPriority, string> = {
  high: "🔥",
  medium: "⚡",
  low: "💡",
};

export default function GrowthPage() {
  const [opps, setOpps] = useState<OpportunitiesResponse | null>(null);
  const [oppLoading, setOppLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [oppError, setOppError] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [codes, setCodes] = useState<ReferralCodeRow[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [creatingCode, setCreatingCode] = useState(false);

  const loadOpportunities = useCallback(async (force = false) => {
    setOppError(null);
    if (force) setRegenerating(true);
    else setOppLoading(true);
    try {
      const res = await fetch("/api/dashboard/growth/opportunities", {
        method: force ? "POST" : "GET",
      });
      const body = (await res.json().catch(() => ({}))) as OpportunitiesResponse;
      if (!res.ok || !body.ok) {
        setOppError(body.error ?? "Failed to load opportunities.");
        return;
      }
      setOpps(body);
    } catch (e) {
      setOppError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setOppLoading(false);
      setRegenerating(false);
    }
  }, []);

  const loadMetrics = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/growth/metrics?days=30");
      const body = (await res.json().catch(() => ({}))) as MetricsResponse & {
        ok?: boolean;
      };
      if (body.ok !== false) setMetrics(body);
    } catch {
      /* non-fatal */
    }
  }, []);

  const loadCodes = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/growth/referral-code");
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        codes?: ReferralCodeRow[];
      };
      if (body.codes) setCodes(body.codes);
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    void loadOpportunities();
    void loadMetrics();
    void loadCodes();
  }, [loadOpportunities, loadMetrics, loadCodes]);

  async function createCode() {
    if (!newLabel.trim()) return;
    setCreatingCode(true);
    try {
      await fetch("/api/dashboard/growth/referral-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel.trim() }),
      });
      setNewLabel("");
      void loadCodes();
    } finally {
      setCreatingCode(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Growth &amp; Opportunities</h1>
          <p className="mt-1 text-sm text-slate-500">
            Claude reads your pipeline + CRM and surfaces the highest-leverage actions to take this
            week. Updated hourly; regenerate anytime.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadOpportunities(true)}
          disabled={regenerating || oppLoading}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {regenerating ? "Analyzing…" : "↻ Refresh opportunities"}
        </button>
      </div>

      <OpportunitiesSection
        loading={oppLoading && !opps}
        error={oppError}
        data={opps}
        regenerating={regenerating}
      />

      <section className="space-y-3 border-t border-slate-200 pt-6">
        <h2 className="text-sm font-semibold text-slate-900">Traffic &amp; referrals (30 days)</h2>

        {metrics ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Page views" value={String(metrics.traffic.pageViews)} />
            <Stat
              label="Conversions"
              value={String(metrics.traffic.conversions)}
              hint={`${metrics.traffic.conversionRate}% rate`}
              tone="green"
            />
            <Stat label="Tool usage" value={String(metrics.traffic.toolUsage)} />
            <Stat
              label="Referral signups"
              value={String(metrics.referrals.eventsSignups)}
              tone="blue"
            />
          </div>
        ) : (
          <div className="text-xs text-slate-400">Loading metrics…</div>
        )}

        {metrics?.viral ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-slate-600">Viral reach</h3>
            <div className="mt-2 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xl font-bold text-slate-900">
                  {metrics.viral.invitesPerSharer.toFixed(1)}
                </p>
                <p className="text-[10px] text-slate-500">Invites / sharer</p>
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900">
                  {metrics.viral.referralShare.toFixed(1)}%
                </p>
                <p className="text-[10px] text-slate-500">Referral share of signups</p>
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900">
                  {metrics.viral.viralCoefficientEstimate.toFixed(2)}
                </p>
                <p className="text-[10px] text-slate-500">Viral K estimate</p>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Referral codes</h2>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Code label (e.g. instagram)"
              className="min-w-[200px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => void createCode()}
              disabled={creatingCode || !newLabel.trim()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {creatingCode ? "Creating…" : "Create code"}
            </button>
          </div>
          {codes.length > 0 ? (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Code</th>
                    <th className="px-3 py-2 text-left font-medium">Label</th>
                    <th className="px-3 py-2 text-right font-medium">Signups</th>
                    <th className="px-3 py-2 text-right font-medium">Conversions</th>
                    <th className="px-3 py-2 text-right font-medium">Shares</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {codes.map((c) => (
                    <tr key={c.code} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono text-xs text-slate-900">{c.code}</td>
                      <td className="px-3 py-2 text-slate-600">{c.label ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.signups_count}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.conversions_count}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.shares_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-400">No referral codes yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function OpportunitiesSection({
  loading,
  error,
  data,
  regenerating,
}: {
  loading: boolean;
  error: string | null;
  data: OpportunitiesResponse | null;
  regenerating: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
        Loading opportunities…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }
  if (!data) return null;

  if (!data.aiConfigured) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <div className="font-medium">AI opportunities aren&apos;t enabled on this environment.</div>
        <div className="mt-1 text-[12px] text-amber-700">
          Set <code className="rounded bg-amber-100 px-1 py-0.5">ANTHROPIC_API_KEY</code> in your
          environment and redeploy.
        </div>
      </div>
    );
  }

  if (data.opportunities.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <div className="text-lg">✨</div>
        <div className="mt-1 text-sm font-medium text-slate-900">Nothing urgent right now.</div>
        <p className="mt-1 text-xs text-slate-500">
          Your pipeline looks healthy. Come back after a few more showings or closings for fresh
          suggestions.
        </p>
      </div>
    );
  }

  const generatedLabel = new Date(data.generatedAtIso).toLocaleString();

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {data.opportunities.map((o) => (
          <OpportunityCard key={o.id} opp={o} regenerating={regenerating} />
        ))}
      </div>
      <div className="text-[11px] text-slate-400">
        Generated {generatedLabel}
        {data.fromCache ? " (cached)" : ""}.
      </div>
    </div>
  );
}

function OpportunityCard({
  opp,
  regenerating,
}: {
  opp: GrowthOpportunity;
  regenerating: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-white p-4 shadow-sm ${regenerating ? "opacity-70" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${PRIORITY_BADGE[opp.priority]}`}
            >
              <span>{PRIORITY_EMOJI[opp.priority]}</span>
              <span className="uppercase tracking-wide">{opp.priority}</span>
            </span>
            <span className="text-[10px] text-slate-500">{CATEGORY_LABEL[opp.category]}</span>
          </div>
          <h3 className="mt-2 text-sm font-semibold text-slate-900">{opp.title}</h3>
        </div>
      </div>

      <p className="mt-2 text-[13px] leading-5 text-slate-700">{opp.insight}</p>
      <p className="mt-2 text-[13px] leading-5 text-slate-900">
        <span className="font-medium">Action:</span> {opp.action}
      </p>

      {opp.context.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {opp.context.map((c, i) => (
            <span
              key={i}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700"
            >
              {c}
            </span>
          ))}
        </div>
      ) : null}

      {opp.actionUrl ? (
        <div className="mt-3">
          <Link
            href={opp.actionUrl}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
          >
            {opp.actionLabel ?? "Take action"} →
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "green" | "blue";
}) {
  const color =
    tone === "green" ? "text-green-700" : tone === "blue" ? "text-blue-700" : "text-slate-900";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="text-[11px] font-medium text-slate-500">{label}</div>
      <div className={`mt-0.5 text-xl font-semibold ${color}`}>{value}</div>
      {hint ? <div className="text-[10px] text-slate-400">{hint}</div> : null}
    </div>
  );
}
