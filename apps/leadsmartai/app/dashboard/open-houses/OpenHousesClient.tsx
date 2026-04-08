"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

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
}: {
  agentId: string;
  properties: PropertyRow[];
}) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [flyerAddress, setFlyerAddress] = useState("");
  const [flyerTemplate, setFlyerTemplate] = useState("classic");

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/open-houses");
      const body = await res.json().catch(() => ({}));
      if (body.ok) setStats(body);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

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

      {/* ── Section 2: Open House Flyer Builder ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Open House Flyer Builder</h2>
          <p className="text-xs text-gray-500 mt-0.5">Enter a property address to generate a professional flyer.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Property Address</label>
          <div className="flex gap-2">
            <input
              value={flyerAddress}
              onChange={(e) => setFlyerAddress(e.target.value)}
              placeholder="Start typing an address..."
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Choose Template</label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: "classic", name: "Classic", desc: "Clean, professional layout with blue accents. Great for any property.", color: "#0072CE" },
              { key: "modern", name: "Modern", desc: "Bold dark header with a contemporary feel. Stands out at open houses.", color: "#6366F1" },
              { key: "luxury", name: "Luxury", desc: "Elegant gold accents with refined styling. Perfect for high-end properties.", color: "#B8860B" },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setFlyerTemplate(t.key)}
                className={`rounded-lg border-2 p-3 text-left transition ${flyerTemplate === t.key ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}
              >
                <div className="h-2 w-full rounded-sm mb-2" style={{ backgroundColor: t.color }} />
                <p className="text-sm font-medium text-gray-900">{t.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <Link
          href={`/dashboard/open-houses/flyer`}
          className="inline-block rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Generate Flyer
        </Link>
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
