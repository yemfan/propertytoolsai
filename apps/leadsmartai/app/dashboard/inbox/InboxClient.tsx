"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Thread = {
  leadId: string;
  channel: "sms" | "email";
  leadName: string | null;
  preview: string;
  lastMessageAt: string;
  lastDirection: "inbound" | "outbound";
  isHotLead: boolean;
};

type Message = {
  id: string;
  message: string;
  subject?: string;
  direction: "inbound" | "outbound";
  channel: string;
  created_at: string;
};

type LeadInfo = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  rating: string | null;
  property_address: string | null;
};

const CHANNEL_ICON: Record<string, string> = { sms: "💬", email: "✉️" };

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function InboxClient() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread" | "sms" | "email">("all");
  const [search, setSearch] = useState("");
  const [selectedLead, setSelectedLead] = useState<{ leadId: string; channel: string } | null>(null);
  const [lead, setLead] = useState<LeadInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadThreads = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/inbox");
      const body = await res.json().catch(() => ({}));
      if (body.ok) setThreads(body.threads ?? []);
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadThreads(); const i = setInterval(loadThreads, 15000); return () => clearInterval(i); }, [loadThreads]);

  async function loadThread(leadId: string, channel: string) {
    setThreadLoading(true);
    setSelectedLead({ leadId, channel });
    setReplyText("");
    setSendMsg(null);
    try {
      const res = await fetch(`/api/dashboard/inbox/thread?leadId=${leadId}&channel=all`);
      const body = await res.json().catch(() => ({}));
      if (body.ok) {
        setLead(body.lead);
        setMessages(body.messages ?? []);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }
    } catch { /* silent */ } finally { setThreadLoading(false); }
  }

  async function sendReply() {
    if (!replyText.trim() || !selectedLead || !lead) return;
    setSending(true); setSendMsg(null);
    try {
      const channel = selectedLead.channel === "email" ? "email" : "sms";
      if (channel === "sms") {
        const res = await fetch("/api/ai-sms/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId: selectedLead.leadId, message: replyText }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? "Send failed");
      } else {
        const res = await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: lead.email, subject: "Re: Follow up", text: replyText }),
        });
        if (!res.ok) throw new Error("Send failed");
      }
      setReplyText("");
      setSendMsg("Sent!");
      // Reload thread
      await loadThread(selectedLead.leadId, selectedLead.channel);
    } catch (e) {
      setSendMsg(e instanceof Error ? e.message : "Failed to send");
    } finally { setSending(false); }
  }

  const filtered = threads.filter((t) => {
    if (filter === "unread" && t.lastDirection !== "inbound") return false;
    if (filter === "sms" && t.channel !== "sms") return false;
    if (filter === "email" && t.channel !== "email") return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      if (!(t.leadName ?? "").toLowerCase().includes(s) && !t.preview.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const unreadCount = threads.filter((t) => t.lastDirection === "inbound").length;

  if (loading) return <div className="py-20 text-center text-gray-400">Loading inbox...</div>;

  return (
    <div className="flex h-[calc(100vh-140px)] min-h-[500px] rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Left panel — conversation list */}
      <div className="w-full max-w-sm shrink-0 flex flex-col border-r border-gray-200">
        <div className="shrink-0 border-b border-gray-100 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">
              Inbox
              {unreadCount > 0 && <span className="ml-2 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">{unreadCount}</span>}
            </h2>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm"
          />
          <div className="flex gap-1">
            {(["all", "unread", "sms", "email"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize ${filter === f ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                {f === "unread" ? `Unread (${unreadCount})` : f}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">No conversations{search ? " match your search" : ""}.</div>
          ) : (
            filtered.map((t) => {
              const isSelected = selectedLead?.leadId === t.leadId && selectedLead?.channel === t.channel;
              const isUnread = t.lastDirection === "inbound";
              return (
                <button
                  key={`${t.leadId}-${t.channel}`}
                  type="button"
                  onClick={() => loadThread(t.leadId, t.channel)}
                  className={`w-full text-left px-3 py-3 border-b border-gray-50 transition ${isSelected ? "bg-blue-50" : "hover:bg-gray-50"}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 text-sm mt-0.5">{CHANNEL_ICON[t.channel] ?? "💬"}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm truncate ${isUnread ? "font-semibold text-gray-900" : "font-medium text-gray-700"}`}>
                          {t.leadName ?? `Lead #${t.leadId}`}
                        </span>
                        <span className="shrink-0 text-[10px] text-gray-400">{timeAgo(t.lastMessageAt)}</span>
                      </div>
                      <p className={`text-xs truncate mt-0.5 ${isUnread ? "text-gray-700" : "text-gray-500"}`}>
                        {t.lastDirection === "outbound" && <span className="text-gray-400">You: </span>}
                        {t.preview}
                      </p>
                    </div>
                    {isUnread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" />}
                    {t.isHotLead && <span className="mt-1 text-[10px]">🔥</span>}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right panel — thread detail */}
      <div className="flex min-w-0 flex-1 flex-col">
        {!selectedLead ? (
          <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
            Select a conversation to view
          </div>
        ) : threadLoading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-gray-400">Loading...</div>
        ) : (
          <>
            {/* Thread header */}
            <div className="shrink-0 border-b border-gray-100 px-4 py-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">{lead?.name ?? `Lead #${selectedLead.leadId}`}</h3>
                <p className="text-xs text-gray-500">
                  {lead?.phone && <span className="mr-3">{lead.phone}</span>}
                  {lead?.email && <span className="mr-3">{lead.email}</span>}
                  {lead?.rating && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${lead.rating === "hot" ? "bg-red-100 text-red-700" : lead.rating === "warm" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>
                      {lead.rating}
                    </span>
                  )}
                </p>
              </div>
              <button onClick={() => setSelectedLead(null)} className="text-xs text-gray-400 hover:text-gray-700 lg:hidden">Close</button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">No messages yet.</p>
              ) : (
                <>
                  {messages.map((m, i) => {
                    const isOutbound = m.direction === "outbound";
                    const showDate = i === 0 || formatDate(m.created_at) !== formatDate(messages[i - 1].created_at);
                    return (
                      <div key={m.id}>
                        {showDate && (
                          <div className="text-center text-[10px] text-gray-400 py-2">{formatDate(m.created_at)}</div>
                        )}
                        <div className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${isOutbound ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-900"}`}>
                            {m.subject && <p className="text-[10px] font-semibold opacity-70 mb-0.5">{m.subject}</p>}
                            <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                            <div className={`flex items-center gap-1.5 mt-1 ${isOutbound ? "justify-end" : ""}`}>
                              <span className="text-[10px] opacity-50">{CHANNEL_ICON[m.channel] ?? ""}</span>
                              <span className="text-[10px] opacity-50">{formatTime(m.created_at)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Reply box */}
            <div className="shrink-0 border-t border-gray-100 p-3">
              {sendMsg && <p className={`text-xs mb-2 ${sendMsg === "Sent!" ? "text-green-700" : "text-red-600"}`}>{sendMsg}</p>}
              <div className="flex gap-2">
                <input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendReply(); } }}
                  placeholder={`Reply via ${selectedLead.channel === "email" ? "email" : "SMS"}...`}
                  className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void sendReply()}
                  disabled={sending || !replyText.trim()}
                  className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {sending ? "..." : "Send"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
