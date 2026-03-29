"use client";

import { useEffect, useState } from "react";

type SmsRow = {
  id?: string;
  message?: string;
  direction?: string;
  created_at?: string;
};

export function SmsConversationPanel({ leadId }: { leadId: string }) {
  const [messages, setMessages] = useState<SmsRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/leads/${leadId}/sms-thread`, { cache: "no-store" });
        const json = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          messages?: SmsRow[];
        };
        if (!cancelled && json?.success) {
          setMessages(Array.isArray(json.messages) ? json.messages : []);
        }
      } catch {
        if (!cancelled) setMessages([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">SMS thread</h2>
        <p className="text-xs text-slate-500 mt-0.5">Inbound / outbound log for this lead</p>
      </div>
      <div className="space-y-3 p-5">
        {loading ? (
          <div className="text-sm text-slate-500">Loading…</div>
        ) : messages.length === 0 ? (
          <div className="text-sm text-slate-500">No SMS messages yet.</div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id ?? `${m.direction}-${m.created_at}`}
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                m.direction === "outbound"
                  ? "ml-auto bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-900"
              }`}
            >
              {m.message}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
