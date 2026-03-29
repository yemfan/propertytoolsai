"use client";

import { useEffect, useState } from "react";

type ConversationItem = {
  id: string;
  direction: "inbound" | "outbound" | "internal";
  channel: string;
  subject?: string | null;
  message: string;
  sender_name?: string | null;
  recipient_name?: string | null;
  created_at: string;
};

export function LeadConversationPanel({
  leadId,
  items,
  onSent,
  composerSeed,
}: {
  leadId: string;
  items: ConversationItem[];
  onSent: () => Promise<void>;
  /** Bump `key` when applying an AI suggestion (or any external draft fill). */
  composerSeed?: { subject: string; message: string; key: number } | null;
}) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!composerSeed) return;
    setSubject(composerSeed.subject);
    setMessage(composerSeed.message);
  }, [composerSeed?.key]);

  async function sendMessage() {
    if (!message.trim() || sending) return;

    setSending(true);
    await fetch("/api/agent/leads/send-message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        leadId,
        subject,
        message,
      }),
    });

    setSubject("");
    setMessage("");
    await onSent();
    setSending(false);
  }

  return (
    <section className="rounded-2xl border bg-white shadow-sm">
      <div className="border-b px-5 py-4">
        <h2 className="text-base font-semibold text-gray-900">Conversation Thread</h2>
      </div>

      <div className="max-h-[420px] space-y-4 overflow-y-auto p-5">
        {items.length === 0 ? (
          <div className="text-sm text-gray-500">No conversation yet.</div>
        ) : (
          items.map((item) => {
            const inbound = item.direction === "inbound";
            return (
              <div
                key={item.id}
                className={`flex ${inbound ? "justify-start" : "justify-end"}`}
              >
                <div className="max-w-[82%]">
                  <div className="mb-1 text-xs text-gray-400">
                    {inbound
                      ? item.sender_name || "Lead"
                      : item.sender_name || "Agent"}{" "}
                    - {new Date(item.created_at).toLocaleString()}
                  </div>
                  <div
                    className={[
                      "rounded-2xl px-4 py-3 text-sm shadow-sm",
                      inbound
                        ? "border bg-white text-gray-900"
                        : "bg-gray-900 text-white",
                    ].join(" ")}
                  >
                    {item.subject ? (
                      <div className="mb-2 font-medium">{item.subject}</div>
                    ) : null}
                    <div className="whitespace-pre-wrap">{item.message}</div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t p-5">
        <div className="space-y-3">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject (optional)"
            className="w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-gray-400"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            placeholder="Write your message..."
            className="w-full resize-none rounded-2xl border px-4 py-3 text-sm outline-none focus:border-gray-400"
          />
          <button
            type="button"
            onClick={() => void sendMessage()}
            disabled={!message.trim() || sending}
            className="rounded-2xl bg-gray-900 px-5 py-3 text-sm font-medium text-white disabled:bg-gray-300"
          >
            {sending ? "Sending..." : "Send Message"}
          </button>
        </div>
      </div>
    </section>
  );
}
