"use client";

import { useEffect, useState } from "react";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  status: string;
  action_url?: string | null;
  created_at: string;
};

export function AgentNotificationsPanel() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/dashboard/agent/notifications", { cache: "no-store" });
    const json = await res.json();
    if (json?.success) setItems(json.notifications ?? []);
    setLoading(false);
  }

  async function markRead(id: string) {
    await fetch("/api/dashboard/agent/notifications/read", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ notificationId: id }),
    });
    await load();
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <section className="rounded-2xl border bg-white shadow-sm">
      <div className="border-b px-5 py-4">
        <h2 className="text-base font-semibold text-gray-900">Notifications</h2>
      </div>

      <div className="p-5">
        {loading ? (
          <div className="text-sm text-gray-500">Loading notifications...</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-gray-500">No notifications.</div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-gray-900">{item.title}</div>
                    <div className="mt-1 text-sm text-gray-600">{item.message}</div>
                  </div>
                  {item.status === "unread" ? (
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                      Unread
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 flex gap-2">
                  {item.action_url ? (
                    <a
                      href={item.action_url}
                      className="rounded-lg border px-3 py-2 text-xs font-medium text-gray-900 hover:bg-gray-50"
                    >
                      Open
                    </a>
                  ) : null}

                  {item.status === "unread" ? (
                    <button
                      type="button"
                      onClick={() => void markRead(item.id)}
                      className="rounded-lg border px-3 py-2 text-xs font-medium text-gray-900 hover:bg-gray-50"
                    >
                      Mark read
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
