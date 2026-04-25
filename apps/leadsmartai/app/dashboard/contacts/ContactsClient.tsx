"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { ClickToCallButton } from "@/components/dashboard/ClickToCallButton";
import { CsvImportModal } from "@/components/crm/CsvImportModal";
import { SendPostcardModal } from "@/components/postcards/SendPostcardModal";
import { BulkSendPostcardModal } from "@/components/postcards/BulkSendPostcardModal";
import { LimitWarningBanner } from "@/components/entitlements/LimitWarningBanner";
import { listOutboundEnabled, type LocaleId } from "@/lib/locales/registry";

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
  /**
   * BCP-47 base id (e.g. "zh") or null. Overrides the agent's default
   * outbound language for AI-generated SMS/email to this contact.
   */
  preferred_language: string | null;
  /** Total showings logged for this contact (all statuses). */
  showing_total?: number;
  /** Count of showings where buyer's overall_reaction = "love". */
  showing_loved?: number;
  /** Offers currently in draft / submitted / countered state. */
  offer_active?: number;
  /** Offers that reached `accepted` status (total, not just this month). */
  offer_won?: number;
};

type ChartItem = { name: string; value: number; color: string };
type GrowthItem = { month: string; label: string; count: number };

type Stats = {
  rating: ChartItem[];
  lastContacted: ChartItem[];
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

export default function ContactsClient({ leads: initialLeads }: { leads: LeadRow[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState("");
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortKey>("created_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<Partial<LeadRow>>({});
  const [addFields, setAddFields] = useState({ name: "", email: "", phone: "", property_address: "", notes: "" });
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [postcardTarget, setPostcardTarget] = useState<{
    contactId: string;
    name: string;
    email: string | null;
    phone: string | null;
  } | null>(null);
  /** Contact ids checkbox-selected for bulk actions (postcards, etc). */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPostcardOpen, setBulkPostcardOpen] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/contacts/stats");
      const body = await res.json().catch(() => ({}));
      if (body.ok) setStats(body);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  async function addContact() {
    setActionLoading(true); setActionMsg(null);
    try {
      const res = await fetch("/api/dashboard/contacts/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...addFields, source: "manual_entry", forceCreate: true }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Failed");
      setAddFields({ name: "", email: "", phone: "", property_address: "", notes: "" });
      setShowAddForm(false);
      setActionMsg("Contact added.");
      // Refresh page data
      window.location.reload();
    } catch (e) { setActionMsg(e instanceof Error ? e.message : "Error"); }
    finally { setActionLoading(false); }
  }

  async function saveEdit(id: string) {
    setActionLoading(true); setActionMsg(null);
    try {
      const res = await fetch(`/api/dashboard/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFields),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Update failed");
      setLeads((prev) => prev.map((l) => l.id === id ? { ...l, ...editFields } as LeadRow : l));
      setEditingId(null);
      setActionMsg("Updated.");
    } catch (e) { setActionMsg(e instanceof Error ? e.message : "Error"); }
    finally { setActionLoading(false); }
  }

  async function markContacted(id: string) {
    setActionLoading(true); setActionMsg(null);
    try {
      const now = new Date().toISOString();
      const res = await fetch(`/api/dashboard/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ last_contacted_at: now }),
      });
      if (!res.ok) throw new Error("Update failed");
      setLeads((prev) => prev.map((l) => l.id === id ? { ...l, last_contacted_at: now } : l));
      setActionMsg("Marked as contacted.");
      loadStats();
    } catch (e) { setActionMsg(e instanceof Error ? e.message : "Error"); }
    finally { setActionLoading(false); }
  }

  function startEdit(lead: LeadRow) {
    setEditingId(lead.id);
    setEditFields({
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      property_address: lead.property_address,
      notes: lead.notes,
      rating: lead.rating,
      preferred_language: lead.preferred_language,
    });
  }

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

      {/* Shows only when the agent is at/near their CRM contact cap. */}
      <LimitWarningBanner action="add_contact" />

      {/* Charts */}
      {stats && (
        <div className="grid gap-3 md:grid-cols-3">
          <MiniPie data={stats.rating} title="Rating Distribution" />
          <MiniPie data={stats.lastContacted} title="Last Contacted" />

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
      {actionMsg && <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">{actionMsg}</div>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShowAddForm((v) => !v)}
          className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          {showAddForm ? "Cancel" : "Enter A Contact"}
        </button>
        <Link
          href="/dashboard/contacts/scan"
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Scan Business Card
        </Link>
        <button
          onClick={() => setCsvImportOpen(true)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Upload CSV
        </button>
        <button type="button" onClick={downloadTemplate} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Download Template
        </button>
      </div>

      {/* Inline add form */}
      {showAddForm && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">New Contact</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={addFields.name} onChange={(e) => setAddFields((f) => ({ ...f, name: e.target.value }))} placeholder="Name" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <input value={addFields.email} onChange={(e) => setAddFields((f) => ({ ...f, email: e.target.value }))} placeholder="Email" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <input value={addFields.phone} onChange={(e) => setAddFields((f) => ({ ...f, phone: e.target.value }))} placeholder="Phone" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <AddressAutocomplete
              value={addFields.property_address}
              onChange={(v) => setAddFields((f) => ({ ...f, property_address: v }))}
              onSelect={(v) => setAddFields((f) => ({ ...f, property_address: v.formattedAddress }))}
              placeholder="Address"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <input value={addFields.notes} onChange={(e) => setAddFields((f) => ({ ...f, notes: e.target.value }))} placeholder="Notes / memo" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <button type="button" onClick={() => void addContact()} disabled={actionLoading || !addFields.name}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">
            {actionLoading ? "Saving..." : "Add Contact"}
          </button>
        </div>
      )}

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

      {/* Bulk action bar — appears only when any row is selected.
          For now the only bulk action is "Send postcard"; more can
          hang off this bar later (tag, export, etc). */}
      {selectedIds.size > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm">
          <div className="text-indigo-900">
            <span className="font-semibold">{selectedIds.size}</span>{" "}
            selected
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="rounded-md px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setBulkPostcardOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              💌 Send postcard to {selectedIds.size}
            </button>
          </div>
        </div>
      ) : null}

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                {/* Select-all for bulk actions (postcards, etc).
                    Toggles all currently filtered contacts. */}
                <th className="w-8 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={
                      filtered.length > 0 &&
                      filtered.every((c) => selectedIds.has(c.id))
                    }
                    onChange={(e) => {
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) filtered.forEach((c) => next.add(c.id));
                        else filtered.forEach((c) => next.delete(c.id));
                        return next;
                      });
                    }}
                    className="h-4 w-4 rounded border-slate-300"
                    aria-label="Select all filtered contacts"
                  />
                </th>
                {([
                  { key: "name" as SortKey, label: "Name" },
                  { key: "email" as SortKey, label: "Email" },
                  { key: null, label: "Phone" },
                  { key: null, label: "Address" },
                  { key: "rating" as SortKey, label: "Rating" },
                  { key: "last_contacted_at" as SortKey, label: "Last Contacted" },
                  { key: null, label: "Memo" },
                  { key: null, label: "" },
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
              {filtered.map((c) => {
                const isEditing = editingId === c.id;
                if (isEditing) {
                  return (
                    <tr key={c.id} className="bg-blue-50/30">
                      {/* Checkbox cell — hidden for the editing row */}
                      <td className="w-8 px-3 py-2" />
                      <td className="px-4 py-2"><input value={editFields.name ?? ""} onChange={(e) => setEditFields((f) => ({ ...f, name: e.target.value }))} className="w-full rounded border border-gray-300 px-2 py-1 text-sm" /></td>
                      <td className="px-4 py-2"><input value={editFields.email ?? ""} onChange={(e) => setEditFields((f) => ({ ...f, email: e.target.value }))} className="w-full rounded border border-gray-300 px-2 py-1 text-sm" /></td>
                      <td className="px-4 py-2"><input value={editFields.phone ?? ""} onChange={(e) => setEditFields((f) => ({ ...f, phone: e.target.value }))} className="w-full rounded border border-gray-300 px-2 py-1 text-sm" /></td>
                      <td className="px-4 py-2"><input value={editFields.property_address ?? ""} onChange={(e) => setEditFields((f) => ({ ...f, property_address: e.target.value }))} className="w-full rounded border border-gray-300 px-2 py-1 text-sm" /></td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <select value={editFields.rating ?? ""} onChange={(e) => setEditFields((f) => ({ ...f, rating: e.target.value || null }))} className="rounded border border-gray-300 px-2 py-1 text-sm">
                            <option value="">—</option>
                            <option value="hot">Hot</option>
                            <option value="warm">Warm</option>
                            <option value="cold">Cold</option>
                          </select>
                          {/* Per-contact preferred language override (BCP-47 base id).
                              Empty = "use agent's default_outbound_language". See
                              lib/locales/resolveLocale.ts for the fallback chain. */}
                          <select
                            value={editFields.preferred_language ?? ""}
                            onChange={(e) => setEditFields((f) => ({ ...f, preferred_language: (e.target.value || null) as LocaleId | null }))}
                            className="rounded border border-gray-300 px-2 py-1 text-sm"
                            title="Preferred language for AI outbound (SMS / email)"
                          >
                            <option value="">Lang: default</option>
                            {listOutboundEnabled().map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.nativeLabel}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500">{timeAgo(c.last_contacted_at)}</td>
                      <td className="px-4 py-2"><input value={editFields.notes ?? ""} onChange={(e) => setEditFields((f) => ({ ...f, notes: e.target.value }))} className="w-full rounded border border-gray-300 px-2 py-1 text-sm" placeholder="Notes" /></td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <button onClick={() => void saveEdit(c.id)} disabled={actionLoading} className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 mr-2">Save</button>
                        <button onClick={() => setEditingId(null)} className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={c.id} className="hover:bg-gray-50/50">
                    <td className="w-8 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(c.id)}
                        onChange={(e) => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(c.id);
                            else next.delete(c.id);
                            return next;
                          });
                        }}
                        className="h-4 w-4 rounded border-slate-300"
                        aria-label={`Select ${c.name ?? "contact"}`}
                      />
                    </td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{c.name ?? "\u2014"}</td>
                    <td className="px-4 py-2.5 text-gray-600 max-w-[180px] truncate">{c.email ?? "\u2014"}</td>
                    <td className="px-4 py-2.5 text-gray-600">
                      {c.phone ? (
                        <span className="inline-flex items-center gap-2">
                          <span>{c.phone}</span>
                          <ClickToCallButton
                            contactId={c.id}
                            contactName={c.name}
                            variant="ghost"
                            iconOnly
                          />
                        </span>
                      ) : (
                        "\u2014"
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 min-w-[200px] max-w-[320px]"><span className="block truncate" title={c.property_address ?? ""}>{c.property_address ?? "\u2014"}</span></td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {c.rating ? (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${RATING_COLORS[c.rating.toLowerCase()] ?? "bg-gray-100 text-gray-600"}`}>
                            {c.rating}
                          </span>
                        ) : (
                          <span className="text-gray-400">{"\u2014"}</span>
                        )}
                        {/* Language override badge — only rendered when the
                            contact has a non-null preferred_language. Shown as
                            nativeLabel (e.g. 中文) so the signal is readable at
                            a glance in a dense table row. */}
                        {c.preferred_language ? (
                          <span
                            className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700"
                            title={`AI outbound in: ${c.preferred_language}`}
                          >
                            {listOutboundEnabled().find((l) => l.id === c.preferred_language)?.nativeLabel ?? c.preferred_language}
                          </span>
                        ) : null}
                        {/* Showing count badge — only when they've seen 1+
                            properties. Separate pill from rating so the signal
                            reads distinct at a glance ("loved" = ♥ stars). */}
                        {c.showing_total && c.showing_total > 0 ? (
                          <Link
                            href={`/dashboard/showings?contactId=${encodeURIComponent(c.id)}`}
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-200"
                            title={`${c.showing_total} showing${c.showing_total === 1 ? "" : "s"}${c.showing_loved ? `, ${c.showing_loved} loved` : ""}`}
                          >
                            {c.showing_total}
                            {c.showing_loved && c.showing_loved > 0 ? (
                              <span className="ml-1 text-red-500">♥{c.showing_loved}</span>
                            ) : null}
                          </Link>
                        ) : null}
                        {/* Offer badge — active count with a ✓N for wins. Only
                            rendered when there's at least one offer logged. */}
                        {(c.offer_active ?? 0) > 0 || (c.offer_won ?? 0) > 0 ? (
                          <Link
                            href={`/dashboard/offers?contactId=${encodeURIComponent(c.id)}`}
                            className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800 hover:bg-amber-100"
                            title={`${c.offer_active ?? 0} active, ${c.offer_won ?? 0} accepted`}
                          >
                            {(c.offer_active ?? 0) > 0 ? `${c.offer_active}` : ""}
                            {(c.offer_won ?? 0) > 0 ? (
                              <span className={(c.offer_active ?? 0) > 0 ? "ml-1" : ""}>
                                ✓{c.offer_won}
                              </span>
                            ) : null}
                          </Link>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{timeAgo(c.last_contacted_at)}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 max-w-[200px] truncate">{c.notes ?? "\u2014"}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <button onClick={() => startEdit(c)} className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 mr-2">Edit</button>
                      <button onClick={() => void markContacted(c.id)} disabled={actionLoading} className="rounded-lg bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 mr-2">Contacted</button>
                      {/* One-click start of a buyer-rep transaction for this
                          contact. NewTransactionClient resolves the display
                          name via ContactPicker on mount — we just pass the
                          id. Property address is filled in-form; we don't
                          pre-fill from `property_address` because that's the
                          buyer's home, not the subject property. */}
                      <Link
                        href={`/dashboard/showings/new?contactId=${encodeURIComponent(c.id)}`}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 mr-2"
                      >
                        Showing
                      </Link>
                      <Link
                        href={`/dashboard/offers/new?contactId=${encodeURIComponent(c.id)}`}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 mr-2"
                      >
                        Offer
                      </Link>
                      <Link
                        href={`/dashboard/transactions/new?contactId=${encodeURIComponent(c.id)}`}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 mr-2"
                      >
                        Start deal
                      </Link>
                      {/* Animated postcard — birthday / anniversary /
                          seasonal / thinking-of-you. Opens in a modal
                          so agents can use it on any contact, not just
                          sphere-tagged ones. */}
                      <button
                        type="button"
                        onClick={() =>
                          setPostcardTarget({
                            contactId: c.id,
                            name: c.name ?? "",
                            email: c.email,
                            phone: c.phone,
                          })
                        }
                        className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        title="Send an animated postcard"
                      >
                        💌 Postcard
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                    {search ? "No contacts match your search." : "No contacts yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CsvImportModal
        open={csvImportOpen}
        onClose={() => setCsvImportOpen(false)}
        onImported={() => window.location.reload()}
      />

      {postcardTarget ? (
        <SendPostcardModal
          open={postcardTarget !== null}
          onClose={() => setPostcardTarget(null)}
          target={postcardTarget}
          onSent={() => {
            setActionMsg("Postcard sent ✓");
          }}
        />
      ) : null}

      {bulkPostcardOpen ? (
        <BulkSendPostcardModal
          open={bulkPostcardOpen}
          onClose={() => setBulkPostcardOpen(false)}
          recipients={leads
            .filter((c) => selectedIds.has(c.id))
            .map((c) => ({
              contactId: c.id,
              name: c.name ?? c.email ?? "friend",
              email: c.email,
              phone: c.phone,
            }))}
          onSent={() => {
            setActionMsg(`Sent ${selectedIds.size} postcards ✓`);
            setSelectedIds(new Set());
          }}
        />
      ) : null}
    </div>
  );
}
