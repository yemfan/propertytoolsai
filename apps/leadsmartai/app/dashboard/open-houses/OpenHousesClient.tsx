"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import QRCode from "react-qr-code";

type PropertyRow = {
  id: string;
  address: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
};

type ChartItem = { name: string; value: number; color: string };
type DayItem = { date: string; label: string; count: number };
type PastOpenHouse = { address: string; visitors: number; leads: number; firstDate: string; lastDate: string };
type Stats = {
  rating: ChartItem[];
  attendanceByDay: DayItem[];
  pastOpenHouses: PastOpenHouse[];
  totalLeads: number;
  recentLeads: number;
};

function labelForProperty(p: PropertyRow) {
  return p.address?.trim() || [p.city, p.state, p.zip_code].filter(Boolean).join(", ") || p.id;
}

function MiniPie({ data, title }: { data: ChartItem[]; title: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-xs font-semibold text-gray-500 mb-2">{title}</h3>
      <div className="flex items-center gap-3">
        <div className="h-[120px] w-[120px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" cx="50%" cy="50%" outerRadius={50} innerRadius={28} strokeWidth={1}>
                {data.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip formatter={(v: number) => v} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-1 text-xs">
          {data.map((d) => (
            <div key={d.name} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
              <span className="text-gray-600">{d.name}</span>
              <span className="font-semibold text-gray-900">{d.value}</span>
              {total > 0 && <span className="text-gray-400">({Math.round((d.value / total) * 100)}%)</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function OpenHousesClient({
  agentId,
  properties,
}: {
  agentId: string;
  properties: PropertyRow[];
}) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState(properties[0]?.id ?? "");
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const origin = useMemo(() => typeof window === "undefined" ? "" : window.location.origin, []);
  const selectedProperty = properties.find((p) => p.id === selectedPropertyId) ?? properties[0];
  const signupUrl = useMemo(() => {
    if (!selectedProperty?.id) return "";
    return `${origin}/open-house-signup?property_id=${encodeURIComponent(selectedProperty.id)}&agent_id=${encodeURIComponent(agentId)}`;
  }, [origin, selectedProperty?.id, agentId]);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/open-houses");
      const body = await res.json().catch(() => ({}));
      if (body.ok) setStats(body);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  async function copyLink() {
    try { await navigator.clipboard.writeText(signupUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* */ }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Open Houses</h1>
          <p className="text-sm text-gray-500">{stats ? `${stats.totalLeads} total visitors` : "Loading..."}</p>
        </div>
      </div>

      {/* ── Section 1: Statistics ── */}
      {stats && (
        <div className="grid gap-3 md:grid-cols-2">
          <MiniPie data={stats.rating} title="Lead Rating (30 days)" />
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-500 mb-2">Attendance by Day (30 days) &mdash; {stats.recentLeads} visitors</h3>
            <div className="h-[120px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.attendanceByDay} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 8 }} stroke="#9ca3af" interval={4} />
                  <YAxis tick={{ fontSize: 9 }} stroke="#9ca3af" allowDecimals={false} />
                  <Tooltip formatter={(v: number) => [v, "Visitors"]} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ── Section 2: New Open House Flyer ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Generate Open House Flyer</h2>
            <p className="text-xs text-gray-500 mt-0.5">Select a property or create a professional flyer with photos.</p>
          </div>
          <Link href="/dashboard/open-houses/flyer" className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
            Create Flyer
          </Link>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Property</label>
            <select
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              {properties.slice(0, 50).map((p) => (
                <option key={p.id} value={p.id}>{labelForProperty(p)}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Signup Link</label>
              <input readOnly value={signupUrl} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono bg-gray-50" />
            </div>
            <button onClick={copyLink} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        {selectedProperty && (
          <div className="flex items-center gap-4">
            <div ref={qrRef} className="bg-white p-2 rounded-lg border border-gray-200 shrink-0">
              <QRCode value={signupUrl} size={100} />
            </div>
            <div className="text-xs text-gray-500">
              <p className="font-medium text-gray-700">{labelForProperty(selectedProperty)}</p>
              <p className="mt-1">Visitors scan this QR code to register and receive a property report.</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Section 3: Past Open Houses ── */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Past Open Houses</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Address</th>
                <th className="text-left px-4 py-2.5 font-medium">Date</th>
                <th className="text-right px-4 py-2.5 font-medium">Visitors</th>
                <th className="text-right px-4 py-2.5 font-medium">Leads</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stats?.pastOpenHouses?.length ? (
                stats.pastOpenHouses.map((oh, i) => (
                  <tr key={i} className="hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 font-medium text-gray-900 max-w-[250px] truncate">{oh.address}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(oh.lastDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{oh.visitors}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{oh.leads}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                    No open house data yet. Share a QR code at your next open house.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
