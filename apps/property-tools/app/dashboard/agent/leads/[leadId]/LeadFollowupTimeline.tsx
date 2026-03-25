"use client";

import { useState } from "react";

type FollowupItem = {
  id: string;
  status: string;
  step_number: number;
  subject?: string | null;
  message: string;
  scheduled_for?: string | null;
};

export function LeadFollowupTimeline({
  items,
  onChanged,
}: {
  items: FollowupItem[];
  onChanged: () => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  function startEdit(item: FollowupItem) {
    setEditingId(item.id);
    setSubject(item.subject || "");
    setMessage(item.message);
  }

  async function saveEdit(followupId: string) {
    setBusyId(followupId);
    await fetch("/api/agent/followups/edit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        followupId,
        subject,
        message,
      }),
    });
    setEditingId(null);
    setBusyId(null);
    await onChanged();
  }

  async function sendNow(followupId: string) {
    setBusyId(followupId);
    await fetch("/api/agent/followups/send-now", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ followupId }),
    });
    setBusyId(null);
    await onChanged();
  }

  return (
    <section className="rounded-2xl border bg-white shadow-sm">
      <div className="border-b px-5 py-4">
        <h2 className="text-base font-semibold text-gray-900">Follow-Up Timeline</h2>
      </div>

      <div className="space-y-3 p-5">
        {items.length === 0 ? (
          <div className="text-sm text-gray-500">No follow-ups found.</div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-gray-900">
                    Step {item.step_number} - {item.subject || "Follow-up"}
                  </div>
                  <div className="mt-1 text-xs text-gray-400">
                    {item.scheduled_for
                      ? new Date(item.scheduled_for).toLocaleString()
                      : "No schedule"}
                  </div>
                </div>

                <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                  {item.status}
                </span>
              </div>

              {editingId === item.id ? (
                <div className="mt-3 space-y-3">
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-gray-400"
                  />
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    className="w-full resize-none rounded-xl border px-4 py-3 text-sm outline-none focus:border-gray-400"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void saveEdit(item.id)}
                      disabled={busyId === item.id}
                      className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:bg-gray-300"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-xl border px-4 py-2 text-sm font-medium text-gray-900"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mt-3 whitespace-pre-wrap text-sm text-gray-700">
                    {item.message}
                  </div>

                  <div className="mt-3 flex gap-2">
                    {item.status === "pending" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="rounded-lg border px-3 py-2 text-xs font-medium text-gray-900 hover:bg-gray-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void sendNow(item.id)}
                          disabled={busyId === item.id}
                          className="rounded-lg border px-3 py-2 text-xs font-medium text-gray-900 hover:bg-gray-50 disabled:bg-gray-100"
                        >
                          {busyId === item.id ? "Sending..." : "Send Now"}
                        </button>
                      </>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
