"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { NewContactModal } from "@/components/crm/NewContactModal";
import LeadAiAssistantPanel from "@/components/dashboard/LeadAiAssistantPanel";
import { HotLeadAlertPanel } from "@/components/crm/HotLeadAlertPanel";
import { OutboundSmsComposer } from "@/components/crm/OutboundSmsComposer";
import { AiEmailComposer } from "@/components/crm/AiEmailComposer";
import { EmailConversationPanel } from "@/components/crm/EmailConversationPanel";
import { GreetingHistoryPanel } from "@/components/crm/GreetingHistoryPanel";
import { showToast } from "@/components/ui/Toast";
import { GreetingPreviewPanel } from "@/components/crm/GreetingPreviewPanel";
import {
  LEAD_STATUS_ORDER,
  type ContactFrequency,
  type ContactMethod,
  type CrmLeadRow,
  type LeadRating,
  type LeadStatus,
} from "@leadsmart/shared";

const STATUS_OPTIONS = LEAD_STATUS_ORDER;

export default function LeadsClient({
  initialLeads,
  planType,
}: {
  initialLeads: CrmLeadRow[];
  planType: string;
}) {
  const [leads, setLeads] = useState<CrmLeadRow[]>(initialLeads);
  const [selected, setSelected] = useState<CrmLeadRow | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [newContactOpen, setNewContactOpen] = useState(false);
  const [stageMap, setStageMap] = useState<Map<string, string>>(new Map());
  const [stageList, setStageList] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);
  const [leadStats, setLeadStats] = useState<{
    status: Array<{ name: string; value: number; color: string }>;
    bySource: Array<{ name: string; value: number; color: string }>;
    growth: Array<{ label: string; count: number }>;
  } | null>(null);

  const loadLeadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/leads/stats");
      const body = await res.json().catch(() => ({}));
      if (body.ok) setLeadStats(body);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadLeadStats(); }, [loadLeadStats]);

  useEffect(() => {
    fetch("/api/dashboard/pipeline/stages").then((r) => r.json()).then((body) => {
      if (body.ok && body.stages) {
        const stages = body.stages as Array<{ id: string; name: string }>;
        const map = new Map<string, string>();
        for (const s of stages) map.set(s.id, s.name);
        setStageMap(map);
        setStageList(stages);
      }
    }).catch(() => {});
  }, []);

  const sources = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => {
      if (l.source) set.add(l.source);
    });
    return Array.from(set).sort();
  }, [leads]);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (statusFilter && (l as any).pipeline_stage_id !== statusFilter) return false;
      if (sourceFilter && (l.source ?? "") !== sourceFilter) return false;
      if (search.trim()) {
        const s = search.trim().toLowerCase();
        const hay = `${l.name ?? ""} ${l.email ?? ""} ${l.phone ?? ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [leads, statusFilter, sourceFilter, search]);

  const isFree = planType === "free";

  async function saveLeadUpdates(next: { lead_status?: LeadStatus; notes?: string; pipeline_stage_id?: string | null }) {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/dashboard/leads/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to update lead.");
      }

      setLeads((prev) =>
        prev.map((l) =>
          l.id === selected.id
            ? { ...l, ...next, lead_status: (next.lead_status ?? l.lead_status) as any }
            : l
        )
      );
      setSelected((prev) => (prev ? { ...prev, ...next } as any : prev));
      showToast("Lead updated.", "success");
    } catch (e: any) {
      showToast(e?.message ?? "Error saving lead.", "error");
    } finally {
      setSaving(false);
    }
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((l) => String(l.id))));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkChangeStage(stageId: string) {
    setBulkSaving(true);
    try {
      await Promise.allSettled(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/dashboard/leads/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pipeline_stage_id: stageId }),
          })
        )
      );
      setLeads((prev) =>
        prev.map((l) => (selectedIds.has(String(l.id)) ? { ...l, pipeline_stage_id: stageId } as any : l))
      );
      setSelectedIds(new Set());
    } catch {
      showToast("Some updates may have failed.", "error");
    } finally {
      setBulkSaving(false);
    }
  }

  function exportSelectedCsv() {
    const rows = filtered.filter((l) => selectedIds.has(String(l.id)));
    if (!rows.length) return;
    const headers = ["Name", "Email", "Phone", "Property", "Source", "Stage", "Created"];
    const csvRows = [
      headers.join(","),
      ...rows.map((l) => [
        `"${(l.name ?? "").replace(/"/g, '""')}"`,
        `"${(l.email ?? "").replace(/"/g, '""')}"`,
        `"${(l.phone ?? "").replace(/"/g, '""')}"`,
        `"${(l.property_address ?? "").replace(/"/g, '""')}"`,
        `"${(l.source ?? "").replace(/"/g, '""')}"`,
        `"${stageMap.get((l as any).pipeline_stage_id ?? "") ?? ""}"`,
        `"${new Date(l.created_at).toLocaleDateString()}"`,
      ].join(",")),
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function MiniPie({ data, title }: { data: Array<{ name: string; value: number; color: string }>; title: string }) {
    const total = data.reduce((s, d) => s + d.value, 0);
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="text-xs font-semibold text-gray-500 mb-2">{title}</h3>
        <div className="flex items-center gap-3">
          <div className="h-[110px] w-[110px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" cx="50%" cy="50%" outerRadius={45} innerRadius={25} strokeWidth={1}>
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
                <span className="text-gray-600 truncate max-w-[80px]">{d.name}</span>
                <span className="font-semibold text-gray-900">{d.value}</span>
                {total > 0 && <span className="text-gray-400">({Math.round((d.value / total) * 100)}%)</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Performance charts */}
      {leadStats && (
        <div className="grid gap-3 md:grid-cols-3">
          <MiniPie data={leadStats.status} title="Lead Status" />
          <MiniPie data={leadStats.bySource} title="Leads by Source" />
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-500 mb-2">Lead Growth (12 months)</h3>
            <div className="h-[110px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leadStats.growth} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} stroke="#9ca3af" interval={1} />
                  <YAxis tick={{ fontSize: 9 }} stroke="#9ca3af" allowDecimals={false} />
                  <Tooltip formatter={(v: number) => [v, "Leads"]} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div>
          <h1 className="ui-page-title text-brand-text">Leads</h1>
          <p className="ui-page-subtitle text-brand-text/80">
            Manage your inbound leads and update pipeline stages.
          </p>
          {isFree && (
            <p className="text-xs text-amber-700 mt-1">
              Starter plan: up to 20 leads.{" "}
              <a href="/dashboard/billing" className="font-semibold underline hover:text-amber-900">
                Upgrade for 500+
              </a>
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setNewContactOpen(true)}
              className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              New contact
            </button>
            <Link
              href="/dashboard/leads/import"
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              Import CSV
            </Link>
            <Link
              href="/dashboard/leads/add"
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 sm:hidden"
            >
              Add (full screen)
            </Link>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name/email/phone"
            className="w-full sm:w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">All stages</option>
            {stageList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">All sources</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <span className="text-sm font-semibold text-blue-800">
            {selectedIds.size} selected
          </span>
          <select
            disabled={bulkSaving}
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) void bulkChangeStage(e.target.value);
              e.target.value = "";
            }}
            className="border border-blue-300 rounded-lg px-3 py-1.5 text-sm bg-white text-blue-800"
          >
            <option value="" disabled>Move to stage...</option>
            {stageList.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button
            onClick={exportSelectedCsv}
            className="border border-blue-300 rounded-lg px-3 py-1.5 text-sm bg-white text-blue-800 hover:bg-blue-100"
          >
            Export CSV
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-sm text-blue-600 hover:text-blue-800"
          >
            Clear
          </button>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="ui-table-header px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                  />
                </th>
                <th className="ui-table-header text-left px-4 py-3">Name</th>
                <th className="ui-table-header text-left px-4 py-3">Email</th>
                <th className="ui-table-header text-left px-4 py-3">Phone</th>
                <th className="ui-table-header text-left px-4 py-3 min-w-[200px]">Property</th>
                <th className="ui-table-header text-left px-4 py-3">Source</th>
                <th className="ui-table-header text-left px-4 py-3">Stage</th>
                <th className="ui-table-header text-left px-4 py-3">AI Score</th>
                <th className="ui-table-header text-left px-4 py-3">Engagement</th>
                <th className="ui-table-header text-left px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr
                  key={l.id}
                  className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelected(l)}
                >
                  <td className="ui-table-cell px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(String(l.id))}
                      onChange={() => toggleSelect(String(l.id))}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    />
                  </td>
                  <td className="ui-table-cell px-4 py-3">{l.name ?? "—"}</td>
                  <td className="ui-table-cell px-4 py-3">{l.email ?? "—"}</td>
                  <td className="ui-table-cell px-4 py-3">{l.phone ?? "—"}</td>
                  <td className="ui-table-cell px-4 py-3 min-w-[220px]">
                    <span className="block" title={l.property_address ?? ""}>{l.property_address ?? "—"}</span>
                  </td>
                  <td className="ui-table-cell px-4 py-3">{l.source ?? "—"}</td>
                  <td className="ui-table-cell px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold bg-brand-surface text-brand-primary border-blue-200">
                      {(l as any).pipeline_stage_id ? stageMap.get((l as any).pipeline_stage_id) ?? "—" : "—"}
                    </span>
                  </td>
                  <td className="ui-table-cell px-4 py-3">
                    <AIScoreBadge
                      score={Number((l as any).ai_lead_score ?? 0)}
                      intent={String((l as any).ai_intent ?? "low")}
                    />
                  </td>
                  <td className="ui-table-cell px-4 py-3">
                    <EngagementBadge score={Number((l as any).nurture_score ?? 0)} />
                    <div className="text-[11px] text-gray-500 mt-1">
                      {(l as any).last_activity_at
                        ? `Last: ${new Date((l as any).last_activity_at).toLocaleDateString()}`
                        : "Last: —"}
                    </div>
                  </td>
                  <td className="ui-table-cell px-4 py-3 text-gray-600">
                    {new Date(l.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-gray-600">
                    No leads found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <LeadDetailPanel
          lead={selected}
          onClose={() => setSelected(null)}
          onSave={saveLeadUpdates}
          saving={saving}
          stageList={stageList}
        />
      )}

      <NewContactModal
        open={newContactOpen}
        onClose={() => setNewContactOpen(false)}
        onCreated={() => window.location.reload()}
      />
    </div>
  );
}

function LeadDetailPanel({
  lead,
  onClose,
  onSave,
  saving,
  stageList,
}: {
  lead: CrmLeadRow;
  onClose: () => void;
  onSave: (next: {
    lead_status?: LeadStatus;
    notes?: string;
    rating?: LeadRating;
    contact_frequency?: ContactFrequency;
    contact_method?: ContactMethod;
    pipeline_stage_id?: string | null;
  }) => void;
  saving: boolean;
  stageList: Array<{ id: string; name: string }>;
}) {
  const [status, setStatus] = useState<LeadStatus>(lead.lead_status);
  const [stage, setStage] = useState<string>((lead as any).pipeline_stage_id ?? "");
  const [notes, setNotes] = useState<string>(lead.notes ?? "");
  const [rating, setRating] = useState<LeadRating>(
    ((lead as any).rating as LeadRating) || "warm"
  );
  const [frequency, setFrequency] = useState<ContactFrequency>(
    ((lead as any).contact_frequency as ContactFrequency) || "weekly"
  );
  const [method, setMethod] = useState<ContactMethod>(
    ((lead as any).contact_method as ContactMethod) || "email"
  );
  const [events, setEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [smsConversation, setSmsConversation] = useState<any | null>(null);
  const [smsMessages, setSmsMessages] = useState<any[]>([]);
  const [loadingSmsConversation, setLoadingSmsConversation] = useState(false);
  const [savingSmsControl, setSavingSmsControl] = useState(false);
  const [smsAiEnabled, setSmsAiEnabled] = useState<boolean>(true);
  const [smsTakeover, setSmsTakeover] = useState<boolean>(false);
  const [emailPanelKey, setEmailPanelKey] = useState(0);

  async function refreshSmsConversation() {
    try {
      const res = await fetch(`/api/dashboard/leads/${lead.id}/sms-conversation`);
      const json = (await res.json().catch(() => ({}))) as any;
      setSmsConversation(json?.conversation ?? null);
      setSmsMessages(Array.isArray(json?.messages) ? json.messages : []);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingEvents(true);
      try {
        const res = await fetch(`/api/dashboard/leads/${lead.id}/events`);
        const json = (await res.json().catch(() => ({}))) as any;
        if (cancelled) return;
        setEvents(Array.isArray(json?.events) ? json.events : []);
      } catch {
        if (!cancelled) setEvents([]);
      } finally {
        if (!cancelled) setLoadingEvents(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lead.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingAlerts(true);
      try {
        const res = await fetch(`/api/dashboard/leads/${lead.id}/nurture-alerts`);
        const json = (await res.json().catch(() => ({}))) as any;
        if (cancelled) return;
        setAlerts(Array.isArray(json?.alerts) ? json.alerts : []);
      } catch {
        if (!cancelled) setAlerts([]);
      } finally {
        if (!cancelled) setLoadingAlerts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lead.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingSmsConversation(true);
      try {
        const res = await fetch(`/api/dashboard/leads/${lead.id}/sms-conversation`);
        const json = (await res.json().catch(() => ({}))) as any;
        if (cancelled) return;
        setSmsConversation(json?.conversation ?? null);
        setSmsMessages(Array.isArray(json?.messages) ? json.messages : []);
        setSmsAiEnabled(Boolean(json?.lead?.sms_ai_enabled ?? true));
        setSmsTakeover(Boolean(json?.lead?.sms_agent_takeover ?? false));
      } catch {
        if (!cancelled) setSmsConversation(null);
      } finally {
        if (!cancelled) setLoadingSmsConversation(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lead.id]);

  async function updateSmsControl(next: { sms_ai_enabled?: boolean; sms_agent_takeover?: boolean }) {
    setSavingSmsControl(true);
    try {
      const res = await fetch(`/api/dashboard/leads/${lead.id}/sms-control`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to update SMS settings");
      if (typeof json?.lead?.sms_ai_enabled === "boolean") {
        setSmsAiEnabled(Boolean(json.lead.sms_ai_enabled));
      }
      if (typeof json?.lead?.sms_agent_takeover === "boolean") {
        setSmsTakeover(Boolean(json.lead.sms_agent_takeover));
      }
    } catch (e: any) {
      showToast(e?.message ?? "Failed to update SMS control", "error");
    } finally {
      setSavingSmsControl(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 w-full sm:w-[480px] bg-white shadow-xl border-l border-gray-200 p-5 overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Lead Details</h2>
            <p className="text-xs text-gray-500">{lead.id}</p>
          </div>
          <button
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="text-sm font-semibold text-gray-900">
              {lead.name ?? "—"}
            </div>
            <div className="mt-1 text-sm text-gray-700">{lead.email ?? "—"}</div>
            <div className="text-sm text-gray-700">{lead.phone ?? "—"}</div>
            <div className="mt-2 text-xs text-gray-500">
              Property: {lead.property_address ?? "—"}
            </div>
            <div className="text-xs text-gray-500">Source: {lead.source ?? "—"}</div>
            <div className="text-xs text-gray-500">
              Created: {new Date(lead.created_at).toLocaleString()}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Stage
            </label>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">— None —</option>
              {stageList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Rating
              </label>
              <select
                value={rating}
                onChange={(e) => setRating(e.target.value as LeadRating)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="hot">Hot</option>
                <option value="warm">Warm</option>
                <option value="cold">Cold</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Frequency
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as ContactFrequency)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Method
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as ContactMethod)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="both">Both</option>
              </select>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-600">
              <span className="font-semibold">AI lead score:</span>{" "}
              {Number((lead as any).ai_lead_score ?? 0)}
              <span className="ml-2 text-[11px] text-slate-500">
                ({String((lead as any).ai_intent ?? "low").toUpperCase()} intent)
              </span>
            </div>
            <div className="text-xs text-slate-600 mt-1">
              <span className="font-semibold">Timeline:</span>{" "}
              {String((lead as any).ai_timeline ?? "—")}
            </div>
            <div className="text-xs text-slate-600 mt-1">
              <span className="font-semibold">Confidence:</span>{" "}
              {Number((lead as any).ai_confidence ?? 0).toFixed(2)}
            </div>
            {!!((lead as any).ai_explanation ?? []).length && (
              <ul className="mt-2 list-disc pl-5 text-xs text-slate-600 space-y-1">
                {((lead as any).ai_explanation as string[]).slice(0, 5).map((x, idx) => (
                  <li key={`${x}-${idx}`}>{x}</li>
                ))}
              </ul>
            )}
          </div>

          <LeadAiAssistantPanel lead={lead} />

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-600">
              <span className="font-semibold">Last contacted:</span>{" "}
              {(lead as any).last_contacted_at
                ? new Date((lead as any).last_contacted_at).toLocaleString()
                : "—"}
            </div>
            <div className="text-xs text-slate-600 mt-1">
              <span className="font-semibold">Next contact:</span>{" "}
              {(lead as any).next_contact_at
                ? new Date((lead as any).next_contact_at).toLocaleString()
                : "—"}
            </div>
            <div className="text-xs text-slate-600 mt-2">
              <span className="font-semibold">Nurture score:</span>{" "}
              {Number((lead as any).nurture_score ?? 0)}
              <span className="ml-2 text-[11px] text-slate-500">
                ({String((lead as any).rating ?? "warm").toUpperCase()})
              </span>
            </div>
            <div className="text-xs text-slate-600 mt-1">
              <span className="font-semibold">Last activity:</span>{" "}
              {(lead as any).last_activity_at
                ? new Date((lead as any).last_activity_at).toLocaleString()
                : "—"}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs font-semibold text-slate-700 mb-2">
              Recent actions
            </div>
            {loadingEvents ? (
              <div className="text-xs text-slate-500">Loading…</div>
            ) : events.length ? (
              <div className="space-y-2">
                {events.slice(0, 10).map((ev) => (
                  <div key={ev.id} className="text-xs text-slate-700">
                    <span className="font-semibold">{ev.event_type}</span>{" "}
                    <span className="text-slate-500">
                      {ev.created_at ? `• ${new Date(ev.created_at).toLocaleString()}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500">No activity yet.</div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs font-semibold text-slate-700 mb-2">
              Agent alerts
            </div>
            {loadingAlerts ? (
              <div className="text-xs text-slate-500">Loading…</div>
            ) : alerts.length ? (
              <div className="space-y-2">
                {alerts.slice(0, 5).map((a) => (
                  <div key={a.id} className="text-xs text-slate-700">
                    <span className="font-semibold">
                      {String(a.type ?? "").toUpperCase()}
                    </span>
                    <div className="text-slate-500 mt-0.5">
                      {a.message ?? ""}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {a.created_at ? new Date(a.created_at).toLocaleString() : ""}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500">No alerts yet.</div>
            )}
          </div>

          {(() => {
            const hotAlert = alerts.find((a) => String(a?.type ?? "").toLowerCase() === "hot");
            const showHot =
              String(rating).toLowerCase() === "hot" || Boolean(hotAlert);
            if (!showHot) return null;
            return (
              <HotLeadAlertPanel
                title="Hot lead — act soon"
                reason={
                  hotAlert?.message ??
                  "This lead is marked hot or has a recent hot alert."
                }
                latestMessage={
                  hotAlert?.message ??
                  "Open the SMS log and nurture alerts for full context."
                }
              />
            );
          })()}

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-slate-700">
                  AI SMS Conversation
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Stage: {smsConversation?.stage ?? "—"} • Last AI reply:{" "}
                  {smsConversation?.last_ai_reply_at
                    ? new Date(smsConversation.last_ai_reply_at).toLocaleString()
                    : "—"}
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                disabled={savingSmsControl}
                onClick={() => updateSmsControl({ sms_ai_enabled: !smsAiEnabled })}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {smsAiEnabled ? "Disable AI SMS" : "Enable AI SMS"}
              </button>
              <button
                type="button"
                disabled={savingSmsControl}
                onClick={() => updateSmsControl({ sms_agent_takeover: !smsTakeover })}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {smsTakeover ? "Release Agent Takeover" : "Take Over Manually"}
              </button>
            </div>
            <div className="mt-2 text-[11px] text-slate-500">
              AI: {smsAiEnabled ? "ON" : "OFF"} • Agent takeover: {smsTakeover ? "ON" : "OFF"}
            </div>

            {loadingSmsConversation ? (
              <div className="text-xs text-slate-500 mt-3">Loading…</div>
            ) : (
              <div className="mt-3 space-y-2 max-h-[180px] overflow-y-auto pr-1">
                {(Array.isArray(smsConversation?.messages)
                  ? smsConversation.messages
                  : []
                )
                  .slice(-10)
                  .map((m: any, idx: number) => (
                    <div key={`${m?.role ?? "msg"}-${idx}`} className="text-xs">
                      <div
                        className={
                          m?.role === "assistant"
                            ? "font-semibold text-brand-primary"
                            : "font-semibold text-slate-900"
                        }
                      >
                        {m?.role === "assistant" ? "AI" : "Lead"}:
                      </div>
                      <div className="text-slate-700">{String(m?.content ?? "")}</div>
                      {m?.created_at && (
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {new Date(m.created_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  ))}
                {!smsConversation?.messages?.length && (
                  <div className="text-xs text-slate-500">No SMS conversation yet.</div>
                )}
              </div>
            )}
            {!!smsMessages.length && (
              <div className="mt-3 border-t border-slate-100 pt-2">
                <div className="text-[11px] font-semibold text-slate-600 mb-1">SMS message log</div>
                <div className="space-y-1 max-h-[120px] overflow-y-auto">
                  {smsMessages.slice(-10).map((m: any) => (
                    <div key={m.id} className="text-[11px] text-slate-600">
                      <span className="font-semibold">{String(m.direction ?? "").toUpperCase()}</span>:{" "}
                      {String(m.message ?? "")}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {String((lead as any).phone_number || lead.phone || "").trim() ? (
            <OutboundSmsComposer
              leadId={String(lead.id)}
              to={String((lead as any).phone_number || lead.phone || "").trim()}
              onSent={() => void refreshSmsConversation()}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
              Add a phone number to this lead to send outbound SMS from the CRM.
            </div>
          )}

          {String(lead.email ?? "").trim() ? (
            <>
              <EmailConversationPanel key={emailPanelKey} leadId={String(lead.id)} />
              <AiEmailComposer
                leadId={String(lead.id)}
                to={String(lead.email).trim()}
                defaultSubject=""
                onSent={() => setEmailPanelKey((k) => k + 1)}
              />
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
              Add an email address to this lead to view the email thread and send from the CRM.
            </div>
          )}

          <GreetingPreviewPanel leadId={String(lead.id)} />
          <GreetingHistoryPanel leadId={String(lead.id)} />

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={6}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary"
              placeholder="Add notes about this lead..."
            />
          </div>

          <button
            onClick={() =>
              onSave({
                lead_status: status,
                notes,
                rating,
                contact_frequency: frequency,
                contact_method: method,
                pipeline_stage_id: stage || null,
              })
            }
            disabled={saving}
            className="w-full inline-flex items-center justify-center bg-brand-primary text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-[#005ca8] disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EngagementBadge({ score }: { score: number }) {
  const label = score >= 7 ? "🔥 Hot" : score >= 3 ? "🌤 Warm" : "❄️ Cold";
  const cls =
    score >= 7
      ? "bg-brand-surface text-brand-success border-green-200"
      : score >= 3
        ? "bg-orange-50 text-accent border-orange-200"
        : "bg-brand-surface text-brand-text border-gray-200";

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${cls}`}>
      {label} • {score}
    </span>
  );
}

function AIScoreBadge({ score, intent }: { score: number; intent: string }) {
  const cls =
    score >= 75
      ? "bg-brand-surface text-brand-success border-green-200"
      : score >= 45
        ? "bg-orange-50 text-accent border-orange-200"
        : "bg-brand-surface text-brand-text border-gray-200";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${cls}`}>
      AI {Math.round(score)} • {intent}
    </span>
  );
}

