"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type LeadRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  property_address: string | null;
  source: string | null;
  rating: string | null;
  last_contacted_at: string | null;
  notes: string | null;
  created_at: string;
};

type ChartItem = { name: string; value: number; color: string };
type GrowthItem = { month: string; label: string; count: number };

type Stats = {
  rating: ChartItem[];
  contacted: ChartItem[];
  growth: GrowthItem[];
  total: number;
};

const CSV_TEMPLATE = "Name,Email,Phone,Address,Type,Notes\nJohn Doe,john@example.com,(555) 123-4567,123 Main St,buyer,Interested in 3bd homes\n";

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "contacts-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function timeAgo(iso: string | null) {
  if (!iso) return "\u2014";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

const RATING_COLORS: Record<string, string> = {
  hot: "bg-red-100 text-red-700",
  warm: "bg-amber-100 text-amber-700",
  cold: "bg-gray-100 text-gray-600",
};

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

type SortKey = "name" | "email" | "rating" | "last_contacted_at" | "created_at";

export default function ContactsClient({ leads }: { leads: LeadRow[] }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState("");
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortKey>("created_at");
  const [sortAsc, setSortAsc] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/contacts/stats");
      const body = await res.json().catch(() => ({}));
      if (body.ok) setStats(body);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  function toggleSort(key: SortKey) {
    if (sortBy === key) setSortAsc((v) => !v);
    else { setSortBy(key); setSortAsc(true); }
  }

  const filtered = leads
    .filter((l) => {
      if (ratingFilter !== "all" && (l.rating ?? "").toLowerCase() !== ratingFilter) return false;
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return (
        (l.name ?? "").toLowerCase().includes(s) ||
        (l.email ?? "").toLowerCase().includes(s) ||
        (l.phone ?? "").includes(s) ||
        (l.property_address ?? "").toLowerCase().includes(s)
      );
    })
    .sort((a, b) => {
      const dir = sortAsc ? 1 : -1;
      const av = a[sortBy] ?? "";
      const bv = b[sortBy] ?? "";
      return av < bv ? -dir : av > bv ? dir : 0;
    });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Contacts</h1>
          <p className="text-sm text-gray-500">{leads.length} total contacts</p>
        </div>
      </div>

      {/* Charts */}
      {stats && (
        <div className="grid gap-3 md:grid-cols-3">
          <MiniPie data={stats.rating} title="Rating Distribution" />
          <MiniPie data={stats.contacted} title="Contacted (30 days)" />

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-500 mb-2">Contact Growth (12 months)</h3>
            <div className="h-[120px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.growth} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} stroke="#9ca3af" interval={1} />
                  <YAxis tick={{ fontSize: 9 }} stroke="#9ca3af" allowDecimals={false} />
                  <Tooltip formatter={(v: number) => [v, "Contacts"]} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/dashboard/leads/add"
          className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Enter A Contact
        </Link>
        <button
          type="button"
          onClick={() => alert("Business card scanning coming soon!")}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Scan Business Card
        </button>
        <Link
          href="/dashboard/leads/import"
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Upload Contacts
        </Link>
        <button
          type="button"
          onClick={downloadTemplate}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Download Template
        </button>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, phone, address..."
          className="flex-1 min-w-[200px] max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={ratingFilter}
          onChange={(e) => setRatingFilter(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
        >
          <option value="all">All ratings</option>
          <option value="hot">Hot</option>
          <option value="warm">Warm</option>
          <option value="cold">Cold</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                {([
                  { key: "name" as SortKey, label: "Name" },
                  { key: "email" as SortKey, label: "Email" },
                  { key: null, label: "Phone" },
                  { key: null, label: "Address" },
                  { key: "rating" as SortKey, label: "Rating" },
                  { key: "last_contacted_at" as SortKey, label: "Last Contacted" },
                  { key: null, label: "Memo" },
                ] as const).map((col, i) => (
                  <th
                    key={i}
                    className={`text-left px-4 py-2.5 font-medium ${col.key ? "cursor-pointer select-none hover:text-gray-900" : ""}`}
                    onClick={() => col.key && toggleSort(col.key)}
                  >
                    {col.label}
                    {col.key && sortBy === col.key && (
                      <span className="ml-1 text-[10px]">{sortAsc ? "\u25B2" : "\u25BC"}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{c.name ?? "\u2014"}</td>
                  <td className="px-4 py-2.5 text-gray-600 max-w-[180px] truncate">{c.email ?? "\u2014"}</td>
                  <td className="px-4 py-2.5 text-gray-600">{c.phone ?? "\u2014"}</td>
                  <td className="px-4 py-2.5 text-gray-600 max-w-[180px] truncate">{c.property_address ?? "\u2014"}</td>
                  <td className="px-4 py-2.5">
                    {c.rating ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${RATING_COLORS[c.rating.toLowerCase()] ?? "bg-gray-100 text-gray-600"}`}>
                        {c.rating}
                      </span>
                    ) : (
                      <span className="text-gray-400">\u2014</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{timeAgo(c.last_contacted_at)}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 max-w-[200px] truncate">{c.notes ?? "\u2014"}</td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    {search ? "No contacts match your search." : "No contacts yet."}
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
