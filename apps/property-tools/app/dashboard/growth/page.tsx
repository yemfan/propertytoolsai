"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Metrics = {
  ok: boolean;
  traffic?: { pageViews: number; conversions: number; conversionRate: number; toolUsage: number };
  referrals?: { codes: number; eventsSignups: number; eventsShares: number; eventsConversions: number };
  viral?: { invitesPerSharer: number; referralShareOfSignups: number; viralCoefficientEstimate: number };
};

type CodeRow = { code: string; label: string; signups_count: number; conversions_count: number; shares_count: number };

export default function GrowthDashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [m, c] = await Promise.all([
      fetch("/api/dashboard/growth/metrics?days=30", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/dashboard/growth/referral-code", { credentials: "include" }).then((r) => r.json()),
    ]);
    setMetrics(m);
    setCodes(Array.isArray(c?.codes) ? c.codes : []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await fetch("/api/dashboard/growth/referral-code", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel || undefined }),
      });
      setNewLabel("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="ui-page-title text-brand-text">Growth</h1>
          <p className="ui-page-subtitle text-brand-text/80">
            Traffic, conversions, referrals, and viral estimates (30 days).
          </p>
        </div>
        <Link href="/dashboard/tools" className="text-sm font-semibold text-blue-700">
          ← Tools
        </Link>
      </div>

      {!metrics?.ok && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Sign in as an agent to view growth metrics.
        </div>
      )}

      {metrics?.ok && metrics.traffic && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Page views" value={metrics.traffic.pageViews} />
          <Stat label="Conversions" value={metrics.traffic.conversions} />
          <Stat label="Conv. rate" value={`${metrics.traffic.conversionRate}%`} />
          <Stat label="Tool usage" value={metrics.traffic.toolUsage} />
        </div>
      )}

      {metrics?.ok && metrics.referrals && metrics.viral && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-900">Referrals & viral</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Stat label="Referral codes" value={metrics.referrals.codes} />
            <Stat label="Ref. signups (events)" value={metrics.referrals.eventsSignups} />
            <Stat label="Ref. shares (events)" value={metrics.referrals.eventsShares} />
            <Stat label="Ref. conversions" value={metrics.referrals.eventsConversions} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm border-t border-slate-100 pt-4">
            <Stat label="Invites / sharer (est.)" value={metrics.viral.invitesPerSharer} />
            <Stat label="Referral share of signups" value={metrics.viral.referralShareOfSignups} />
            <Stat label="Viral K (heuristic)" value={metrics.viral.viralCoefficientEstimate} />
          </div>
          <p className="text-xs text-slate-500">
            K is a rough index combining shares and signups — tune with your product analytics over time.
          </p>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-bold text-slate-900">Your referral codes</h2>
        <form onSubmit={createCode} className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Label</label>
            <input
              className="block rounded-lg border border-slate-200 px-3 py-2 text-sm mt-1"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Spring campaign"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-slate-900 text-white text-sm font-semibold px-4 py-2 disabled:opacity-50"
          >
            Generate code
          </button>
        </form>
        <ul className="divide-y divide-slate-100 text-sm">
          {codes.map((c) => (
            <li key={c.code} className="py-3 flex flex-wrap justify-between gap-2">
              <div>
                <div className="font-mono font-bold text-blue-800">{c.code}</div>
                <div className="text-xs text-slate-500">{c.label}</div>
              </div>
              <div className="text-xs text-slate-600">
                signups {c.signups_count} · conv {c.conversions_count} · shares {c.shares_count}
              </div>
            </li>
          ))}
          {!codes.length && <li className="py-4 text-slate-500">No codes yet.</li>}
        </ul>
        <p className="text-xs text-slate-500">
          Share links like <code className="bg-slate-100 px-1 rounded">?ref=CODE</code> — record events via{" "}
          <code className="bg-slate-100 px-1 rounded">POST /api/growth/referral/record</code>.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <div className="text-[11px] font-semibold uppercase text-slate-500">{label}</div>
      <div className="text-lg font-bold text-slate-900 mt-1">{value}</div>
    </div>
  );
}
