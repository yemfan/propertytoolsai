"use client";

import { useCallback, useEffect, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

type Metrics = {
  traffic: { page_views: number; conversions: number; conversion_rate: number; tool_usage: number };
  referrals: { codes: number; signups: number; shares: number; conversions: number };
  viral: { invites_per_sharer: number; referral_share: number; viral_k: number };
};

type ReferralCode = { code: string; label: string; signups: number; conversions: number; shares: number };

export default function GrowthPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [codes, setCodes] = useState<ReferralCode[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const [mRes, cRes] = await Promise.all([
      fetch("/api/dashboard/growth/metrics?days=30").then((r) => r.json()).catch(() => ({})),
      fetch("/api/dashboard/growth/referral-code").then((r) => r.json()).catch(() => ({})),
    ]);
    if (mRes.ok !== false) setMetrics(mRes);
    if (cRes.codes) setCodes(cRes.codes);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createCode() {
    if (!newLabel.trim()) return;
    setCreating(true);
    try {
      await fetch("/api/dashboard/growth/referral-code", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel }),
      });
      setNewLabel(""); load();
    } catch { /* */ }
    finally { setCreating(false); }
  }

  const t = metrics?.traffic;
  const r = metrics?.referrals;
  const v = metrics?.viral;

  const trafficPie = t ? [
    { name: "Conversions", value: t.conversions, color: "#22c55e" },
    { name: "Views only", value: Math.max(0, t.page_views - t.conversions), color: "#e5e7eb" },
  ] : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Growth</h1>
        <p className="text-sm text-gray-500">Traffic, referrals, and viral metrics (30 days).</p>
      </div>

      {/* KPI Cards */}
      {t && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-gray-500">Page Views</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{t.page_views}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-gray-500">Conversions</p>
            <p className="mt-1 text-2xl font-bold text-green-600">{t.conversions}</p>
            <p className="text-xs text-gray-400">{t.conversion_rate}% rate</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-gray-500">Tool Usage</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{t.tool_usage}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-gray-500">Referral Signups</p>
            <p className="mt-1 text-2xl font-bold text-blue-600">{r?.signups ?? 0}</p>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-3 md:grid-cols-2">
        {trafficPie.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-500 mb-2">Conversion Rate</h3>
            <div className="flex items-center gap-3">
              <div className="h-[110px] w-[110px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={trafficPie} dataKey="value" cx="50%" cy="50%" outerRadius={45} innerRadius={25} strokeWidth={1}>
                      {trafficPie.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1 text-xs">
                {trafficPie.map((d) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-gray-600">{d.name}</span>
                    <span className="font-semibold text-gray-900">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {v && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-500 mb-3">Viral Metrics</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{v.invites_per_sharer.toFixed(1)}</p>
                <p className="text-[10px] text-gray-500">Invites / Sharer</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{v.referral_share.toFixed(1)}%</p>
                <p className="text-[10px] text-gray-500">Referral Share</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{v.viral_k.toFixed(2)}</p>
                <p className="text-[10px] text-gray-500">Viral K</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Referral Codes */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Referral Codes</h2>
        <div className="flex gap-2">
          <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Code label..." className="flex-1 max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <button onClick={() => void createCode()} disabled={creating || !newLabel.trim()} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">
            {creating ? "..." : "Create Code"}
          </button>
        </div>
        {codes.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Code</th>
                  <th className="text-left px-4 py-2 font-medium">Label</th>
                  <th className="text-right px-4 py-2 font-medium">Signups</th>
                  <th className="text-right px-4 py-2 font-medium">Conversions</th>
                  <th className="text-right px-4 py-2 font-medium">Shares</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {codes.map((c) => (
                  <tr key={c.code} className="hover:bg-gray-50/50">
                    <td className="px-4 py-2 font-mono text-xs text-gray-900">{c.code}</td>
                    <td className="px-4 py-2 text-gray-600">{c.label}</td>
                    <td className="px-4 py-2 text-right font-semibold">{c.signups}</td>
                    <td className="px-4 py-2 text-right font-semibold">{c.conversions}</td>
                    <td className="px-4 py-2 text-right font-semibold">{c.shares}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400">No referral codes yet.</p>
        )}
      </div>
    </div>
  );
}
