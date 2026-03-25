"use client";

import { useEffect, useState } from "react";

type FollowupItem = {
  id: string;
  lead_id: string;
  subject?: string | null;
  message: string;
  status: string;
  step_number: number;
  scheduled_for: string;
  recipient_name?: string | null;
  recipient_email?: string | null;
  sequence_key?: string | null;
};

export function FollowupQueuePanel() {
  const [items, setItems] = useState<FollowupItem[]>([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch(
      `/api/dashboard/agent/followups?status=${encodeURIComponent(statusFilter)}`,
      { cache: "no-store" }
    );
    const json = await res.json();
    if (json?.success) setItems(json.followups ?? []);
    setLoading(false);
  }

  async function cancelLeadSequence(leadId: string) {
    await fetch("/api/dashboard/agent/followups/cancel", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ leadId }),
    });
    await load();
  }

  async function resendFollowup(followupId: string) {
    await fetch("/api/dashboard/agent/followups/resend", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ followupId }),
    });
    await load();
  }

  useEffect(() => {
    void load();
  }, [statusFilter]);

  return (
    <section className="rounded-2xl border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <h2 className="text-base font-semibold text-gray-900">Follow-Up Queue</h2>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          <option value="pending">Pending</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="p-5">
        {loading ? (
          <div className="text-sm text-gray-500">Loading follow-ups...</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-gray-500">No follow-ups found.</div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-xl border p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="font-medium text-gray-900">
                      Step {item.step_number} - {item.subject || "Follow-up"}
                    </div>
                    <div className="mt-1 text-sm text-gray-600">
                      To: {item.recipient_name || "Lead"}{" "}
                      {item.recipient_email ? `(${item.recipient_email})` : ""}
                    </div>
                    <div className="mt-2 text-sm text-gray-700">{item.message}</div>
                    <div className="mt-2 text-xs text-gray-400">
                      Scheduled: {new Date(item.scheduled_for).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {item.status === "pending" ? (
                      <button
                        type="button"
                        onClick={() => void cancelLeadSequence(item.lead_id)}
                        className="rounded-lg border px-3 py-2 text-xs font-medium text-gray-900 hover:bg-gray-50"
                      >
                        Cancel sequence
                      </button>
                    ) : null}

                    {item.status === "failed" ? (
                      <button
                        type="button"
                        onClick={() => void resendFollowup(item.id)}
                        className="rounded-lg border px-3 py-2 text-xs font-medium text-gray-900 hover:bg-gray-50"
                      >
                        Retry
                      </button>
                    ) : null}

                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                      {item.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
