"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { NewContactModal } from "@/components/crm/NewContactModal";
import LeadCalendarBookingPanel from "@/components/dashboard/LeadCalendarBookingPanel";
import LeadPipelineTasksPanel from "@/components/dashboard/LeadPipelineTasksPanel";
import LeadAiAssistantPanel from "@/components/dashboard/LeadAiAssistantPanel";
import type { CrmLeadRow } from "@leadsmart/shared";

type Lead = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  property_address: string | null;
  source: string | null;
  lead_status: string | null;
  notes?: string | null;
  rating?: string | null;
  engagement_score?: number | null;
  last_activity_at?: string | null;
  search_location?: string | null;
  search_radius?: number | null;
  price_min?: number | null;
  price_max?: number | null;
  beds?: number | null;
  baths?: number | null;
  created_at: string;
  pipeline_stage_id?: string | null;
};

const STATUS_OPTIONS = ["new", "contacted", "closed"] as const;
type Status = (typeof STATUS_OPTIONS)[number];

function statusClasses(status: string | null | undefined): string {
  switch (status) {
    case "new":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "contacted":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "closed":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

export default function LeadsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leadCount, setLeadCount] = useState<number | null>(null);
  const [leadLimit, setLeadLimit] = useState<number | null>(null);
  const [limitPlan, setLimitPlan] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [quickFilter, setQuickFilter] = useState<string>(
    searchParams?.get("filter") ?? ""
  );
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [savingNotif, setSavingNotif] = useState(false);
  const [newContactOpen, setNewContactOpen] = useState(false);
  const [notifDraft, setNotifDraft] = useState<{
    search_location: string;
    search_radius: string;
    price_min: string;
    price_max: string;
    beds: string;
    baths: string;
  }>({
    search_location: "",
    search_radius: "2",
    price_min: "",
    price_max: "",
    beds: "",
    baths: "",
  });

  useEffect(() => {
    if (!selectedLead) return;
    setNotifDraft({
      search_location: selectedLead.search_location ?? selectedLead.property_address ?? "",
      search_radius:
        selectedLead.search_radius != null ? String(selectedLead.search_radius) : "2",
      price_min: selectedLead.price_min != null ? String(selectedLead.price_min) : "",
      price_max: selectedLead.price_max != null ? String(selectedLead.price_max) : "",
      beds: selectedLead.beds != null ? String(selectedLead.beds) : "",
      baths: selectedLead.baths != null ? String(selectedLead.baths) : "",
    });
  }, [selectedLead]);

  // Keep URL in sync when quick filter changes (for deep-linking from overview).
  useEffect(() => {
    const current = new URLSearchParams(
      searchParams ? Array.from(searchParams.entries()) : []
    );
    if (quickFilter) {
      current.set("filter", quickFilter);
    } else {
      current.delete("filter");
    }
    const qs = current.toString();
    router.replace(`/dashboard/leads${qs ? `?${qs}` : ""}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickFilter]);

  useEffect(() => {
    let cancelled = false;
    async function loadCount() {
      try {
        const res = await fetch("/api/leads/count", { credentials: "include" });
        const json = (await res.json().catch(() => ({}))) as any;
        if (!res.ok || json?.ok === false) return;
        if (!cancelled) {
          setLeadCount(Number(json.count ?? 0));
          setLeadLimit(json.limit == null ? null : Number(json.limit));
          setLimitPlan(String(json.plan ?? ""));
        }
      } catch {}
    }
    loadCount();
    return () => {
      cancelled = true;
    };
  }, []);

  const reloadLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (quickFilter) params.set("filter", quickFilter);
      const res = await fetch(`/api/dashboard/leads?${params.toString()}`);
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error ?? "Failed to load leads.");
      }
      setLeads((json.leads ?? []) as Lead[]);
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong while loading leads.");
    } finally {
      setLoading(false);
    }
  }, [quickFilter]);

  useEffect(() => {
    void reloadLeads();
  }, [reloadLeads]);

  const showIntakeActions = true;

  const sourceOptions = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => {
      if (l.source) set.add(l.source);
    });
    return ["all", ...Array.from(set).sort()];
  }, [leads]);

  const visibleLeads = useMemo(() => {
    return leads.filter((l) => {
      if (sourceFilter !== "all" && l.source !== sourceFilter) return false;
      if (statusFilter !== "all" && l.lead_status !== statusFilter) return false;
      return true;
    });
  }, [leads, sourceFilter, statusFilter]);

  async function handleStatusChange(id: string, nextStatus: Status) {
    setUpdatingId(id);
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: nextStatus }),
      });
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error ?? "Failed to update lead.");
      }
      const updated: Lead | undefined = json.lead;
      if (updated) {
        setLeads((prev) =>
          prev.map((l) => (l.id === id ? { ...l, lead_status: updated.lead_status } : l))
        );
      }
    } catch (e: any) {
      setError(e?.message ?? "Could not update lead status.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleSaveNotificationSettings() {
    if (!selectedLead) return;
    setSavingNotif(true);
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedLead.id,
          search_location: notifDraft.search_location.trim() || null,
          search_radius: notifDraft.search_radius.trim() || null,
          price_min: notifDraft.price_min.trim() || null,
          price_max: notifDraft.price_max.trim() || null,
          beds: notifDraft.beds.trim() || null,
          baths: notifDraft.baths.trim() || null,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error ?? "Failed to save notification settings.");
      }

      const updated: Lead | undefined = json.lead;
      if (updated) {
        setLeads((prev) => prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)));
        setSelectedLead(updated);
      }
    } catch (e: any) {
      setError(e?.message ?? "Could not save notification settings.");
    } finally {
      setSavingNotif(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
          <p className="text-sm text-slate-600">
            View and update leads captured from your LeadSmart AI funnels.
          </p>
        </div>
        {showIntakeActions ? (
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setNewContactOpen(true)}
              className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              New contact
            </button>
            <Link
              href="/dashboard/leads/import"
              className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Import CSV
            </Link>
            <Link
              href="/dashboard/leads/add"
              className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 md:hidden"
            >
              Add (full screen)
            </Link>
          </div>
        ) : null}
      </div>

      {leadLimit != null && leadCount != null ? (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm font-semibold text-slate-900">
              Leads: {leadCount} / {leadLimit}
            </div>
            <div className="text-xs text-slate-600">
              Plan: <span className="font-semibold">{(limitPlan ?? "").toUpperCase()}</span>
            </div>
          </div>
          <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full ${
                leadCount >= leadLimit ? "bg-red-500" : leadCount >= leadLimit * 0.9 ? "bg-amber-500" : "bg-emerald-500"
              }`}
              style={{ width: `${Math.min(100, Math.round((leadCount / leadLimit) * 100))}%` }}
            />
          </div>
          {leadCount >= leadLimit * 0.9 && leadCount < leadLimit ? (
            <div className="mt-2 text-xs text-amber-700 font-semibold">
              You’re near your lead limit
            </div>
          ) : null}
          {leadCount >= leadLimit ? (
            <div className="mt-2 text-xs text-red-700 font-semibold">
              Upgrade to Premium for unlimited leads
            </div>
          ) : null}
        </div>
      ) : null}

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div className="flex gap-2 flex-wrap items-center">
            <div className="text-xs font-semibold text-slate-700">Filters:</div>
            <div className="flex gap-1 flex-wrap">
              <button
                type="button"
                onClick={() => setQuickFilter("")}
                className={`px-3 py-1 rounded-full border text-xs ${
                  !quickFilter
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-300"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setQuickFilter("hot")}
                className={`px-3 py-1 rounded-full border text-xs ${
                  quickFilter === "hot"
                    ? "bg-orange-600 text-white border-orange-600"
                    : "bg-white text-slate-700 border-slate-300"
                }`}
              >
                Hot leads
              </button>
              <button
                type="button"
                onClick={() => setQuickFilter("high_engagement")}
                className={`px-3 py-1 rounded-full border text-xs ${
                  quickFilter === "high_engagement"
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white text-slate-700 border-slate-300"
                }`}
              >
                High engagement (&gt;70)
              </button>
              <button
                type="button"
                onClick={() => setQuickFilter("inactive")}
                className={`px-3 py-1 rounded-full border text-xs ${
                  quickFilter === "inactive"
                    ? "bg-amber-600 text-white border-amber-600"
                    : "bg-white text-slate-700 border-slate-300"
                }`}
              >
                Needs follow-up
              </button>
            </div>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white"
            >
              {sourceOptions.map((s) => (
                <option key={s} value={s}>
                  {s === "all" ? "All Sources" : s}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white"
            >
              <option value="all">All Statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs text-slate-600">
            Showing <span className="font-semibold">{visibleLeads.length}</span> of{" "}
            <span className="font-semibold">{leads.length}</span>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="px-4 py-6 text-sm text-slate-600">Loading leads…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Name</th>
                  <th className="text-left px-4 py-3 font-semibold">Email</th>
                  <th className="text-left px-4 py-3 font-semibold">Rating</th>
                  <th className="text-left px-4 py-3 font-semibold">Score</th>
                  <th className="text-left px-4 py-3 font-semibold">Last activity</th>
                  <th className="text-left px-4 py-3 font-semibold">Address</th>
                  <th className="text-left px-4 py-3 font-semibold">Source</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                  <th className="text-left px-4 py-3 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody>
                {visibleLeads.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-6 text-sm text-slate-600 text-center"
                    >
                      No leads match the selected filters.
                    </td>
                  </tr>
                ) : (
                  visibleLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-t border-slate-100 hover:bg-slate-50"
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedLead(lead)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") setSelectedLead(lead);
                      }}
                    >
                      <td className="px-4 py-3">{lead.name ?? "—"}</td>
                      <td className="px-4 py-3">{lead.email ?? "—"}</td>
                      <td className="px-4 py-3">{lead.rating ?? "—"}</td>
                      <td className="px-4 py-3">
                        {typeof lead.engagement_score === "number"
                          ? lead.engagement_score
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                        {lead.last_activity_at
                          ? new Date(lead.last_activity_at).toLocaleString()
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {lead.property_address ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {lead.source ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClasses(
                              lead.lead_status
                            )}`}
                          >
                            {lead.lead_status ?? "unknown"}
                          </span>
                          <select
                            value={lead.lead_status ?? "new"}
                            disabled={updatingId === lead.id}
                            onChange={(e) =>
                              handleStatusChange(
                                lead.id,
                                e.target.value as Status
                              )
                            }
                            className="border border-slate-300 rounded-md px-2 py-1 text-xs bg-white"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                        {new Date(lead.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedLead ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-3">
          <div className="w-full max-w-xl bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 truncate">
                  {selectedLead.name ?? "Lead"}
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  {selectedLead.email ?? "—"} • {selectedLead.phone ?? "—"}
                </div>
              </div>
              <button
                type="button"
                className="text-sm font-semibold px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50"
                onClick={() => setSelectedLead(null)}
              >
                Close
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <LeadPipelineTasksPanel
                leadId={selectedLead.id}
                pipelineStageId={selectedLead.pipeline_stage_id ?? null}
                onStageChange={(stageId) => {
                  setSelectedLead((L) => (L ? { ...L, pipeline_stage_id: stageId } : null));
                  setLeads((prev) =>
                    prev.map((l) =>
                      l.id === selectedLead.id ? { ...l, pipeline_stage_id: stageId } : l
                    )
                  );
                }}
              />

              <LeadCalendarBookingPanel leadId={selectedLead.id} />

              <LeadAiAssistantPanel lead={selectedLead as unknown as CrmLeadRow} />

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Property
                </div>
                <div className="text-sm font-semibold text-slate-900 mt-1">
                  {selectedLead.property_address ?? "—"}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Source
                  </div>
                  <div className="text-sm text-slate-900 mt-1">
                    {selectedLead.source ?? "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </div>
                  <div className="text-sm text-slate-900 mt-1">
                    {selectedLead.lead_status ?? "—"}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Notes
                </div>
                <div className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">
                  {selectedLead.notes ?? "—"}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-semibold text-slate-900">
                  Nearby Activity Search
                </div>
                <div className="text-xs text-slate-600">
                  Notifications will match listings/sales near the visitor’s saved location.
                  Leave blank to disable.
                </div>

                <div className="space-y-2">
                  <label className="block">
                    <div className="text-xs font-semibold text-slate-700">Search location</div>
                    <input
                      value={notifDraft.search_location}
                      onChange={(e) =>
                        setNotifDraft((d) => ({ ...d, search_location: e.target.value }))
                      }
                      placeholder="e.g. 123 Main St, City, ST"
                      className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </label>

                  <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                    <label className="flex-1">
                      <div className="text-xs font-semibold text-slate-700">Radius (miles)</div>
                      <input
                        value={notifDraft.search_radius}
                        onChange={(e) =>
                          setNotifDraft((d) => ({ ...d, search_radius: e.target.value }))
                        }
                        inputMode="decimal"
                        placeholder="2"
                        className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedLead.property_address) return;
                        setNotifDraft((d) => ({
                          ...d,
                          search_location: selectedLead.property_address ?? "",
                        }));
                      }}
                      className="inline-flex items-center justify-center rounded-xl bg-white px-3 py-2 text-sm font-semibold border border-slate-200 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
                      disabled={!selectedLead.property_address}
                    >
                      Use property address
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label>
                      <div className="text-xs font-semibold text-slate-700">Price min</div>
                      <input
                        value={notifDraft.price_min}
                        onChange={(e) =>
                          setNotifDraft((d) => ({ ...d, price_min: e.target.value }))
                        }
                        inputMode="decimal"
                        placeholder=""
                        className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                    <label>
                      <div className="text-xs font-semibold text-slate-700">Price max</div>
                      <input
                        value={notifDraft.price_max}
                        onChange={(e) =>
                          setNotifDraft((d) => ({ ...d, price_max: e.target.value }))
                        }
                        inputMode="decimal"
                        placeholder=""
                        className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label>
                      <div className="text-xs font-semibold text-slate-700">Beds (optional)</div>
                      <input
                        value={notifDraft.beds}
                        onChange={(e) =>
                          setNotifDraft((d) => ({ ...d, beds: e.target.value }))
                        }
                        inputMode="numeric"
                        placeholder=""
                        className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                    <label>
                      <div className="text-xs font-semibold text-slate-700">Baths (optional)</div>
                      <input
                        value={notifDraft.baths}
                        onChange={(e) =>
                          setNotifDraft((d) => ({ ...d, baths: e.target.value }))
                        }
                        inputMode="numeric"
                        placeholder=""
                        className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                  </div>
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    disabled={savingNotif}
                    onClick={handleSaveNotificationSettings}
                    className="w-full inline-flex items-center justify-center rounded-xl bg-blue-600 text-white text-sm font-semibold px-4 py-3 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {savingNotif ? "Saving..." : "Save Notification Settings"}
                  </button>
                </div>
              </div>

              {selectedLead.property_address ? (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const addr = selectedLead.property_address ?? "";
                      if (!addr.trim()) return;
                      router.push(
                        `/smart-cma-builder?save=1&lead_id=${encodeURIComponent(
                          selectedLead.id
                        )}&address=${encodeURIComponent(addr)}`
                      );
                      setSelectedLead(null);
                    }}
                    className="w-full inline-flex items-center justify-center rounded-xl bg-blue-600 text-white text-sm font-semibold px-4 py-3 hover:bg-blue-700"
                  >
                    Create Report for Lead
                  </button>
                  <p className="mt-2 text-xs text-slate-600 text-center">
                    Generates and saves an Estimator + CMA report, attached to this lead.
                  </p>
                </div>
              ) : null}
            </div>

            <div className="p-5 border-t border-slate-100 text-xs text-slate-500">
              Created: {new Date(selectedLead.created_at).toLocaleString()}
            </div>
          </div>
        </div>
      ) : null}

      <NewContactModal
        open={newContactOpen}
        onClose={() => setNewContactOpen(false)}
        onCreated={() => {
          void reloadLeads();
          void fetch("/api/leads/count", { credentials: "include" })
            .then((r) => r.json().catch(() => ({})))
            .then((json: any) => {
              if (json?.ok === false) return;
              setLeadCount(Number(json.count ?? 0));
              setLeadLimit(json.limit == null ? null : Number(json.limit));
              setLimitPlan(String(json.plan ?? ""));
            });
        }}
      />
    </div>
  );
}

