"use client";

import { useCallback, useEffect, useState } from "react";

type QueueLead = {
  id: number | string;
  name: string | null;
  email: string | null;
  phone: string | null;
  property_address: string | null;
  source: string | null;
  lead_status: string | null;
  rating: string | null;
  created_at: string | null;
};

export function LeadQueueClient() {
  const [leads, setLeads] = useState<QueueLead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/lead-queue?pageSize=50");
      const body = await res.json().catch(() => ({}));
      if (body.ok) {
        setLeads(body.leads ?? []);
        setTotal(body.total ?? 0);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 15_000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  async function claimLead(leadId: string) {
    setClaiming(leadId);
    setFeedback(null);
    try {
      const res = await fetch("/api/dashboard/lead-queue/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok) {
        setLeads((prev) => prev.filter((l) => String(l.id) !== leadId));
        setTotal((prev) => Math.max(0, prev - 1));
        setFeedback("Lead claimed! It's now in your CRM.");
      } else if (res.status === 409) {
        setFeedback("This lead was already claimed by another agent.");
        fetchQueue();
      } else {
        setFeedback(body.error ?? "Failed to claim lead.");
      }
    } catch {
      setFeedback("Network error. Please try again.");
    } finally {
      setClaiming(null);
    }
  }

  function timeAgo(dateStr: string | null) {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        Loading queue...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Lead Queue</h1>
          <p className="text-sm text-gray-500">
            {total} unclaimed lead{total !== 1 ? "s" : ""} available
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchQueue(); }}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {feedback && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-2 text-sm text-blue-800">
          {feedback}
        </div>
      )}

      {leads.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
          <p className="text-gray-500">No leads in the queue right now.</p>
          <p className="mt-1 text-sm text-gray-400">New leads will appear here automatically.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {leads.map((lead) => {
            const id = String(lead.id);
            return (
              <div
                key={id}
                className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-3 space-y-1">
                  <h3 className="font-medium text-gray-900 truncate">
                    {lead.name || "Unnamed lead"}
                  </h3>
                  {lead.email && (
                    <p className="text-sm text-gray-500 truncate">{lead.email}</p>
                  )}
                  {lead.phone && (
                    <p className="text-sm text-gray-500">{lead.phone}</p>
                  )}
                  {lead.property_address && (
                    <p className="text-sm text-gray-500 truncate">{lead.property_address}</p>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      {lead.source ?? "unknown"}
                    </span>
                    <span className="text-xs text-gray-400">
                      {timeAgo(lead.created_at)}
                    </span>
                  </div>
                  <button
                    disabled={claiming === id}
                    onClick={() => claimLead(id)}
                    className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                  >
                    {claiming === id ? "Claiming..." : "Claim"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
